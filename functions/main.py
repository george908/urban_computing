
import requests
import xml.etree.ElementTree as ET
import firebase_admin
import math
from firebase_admin import firestore
from firebase_functions import https_fn, firestore_fn
from datetime import datetime, timezone


firebase_admin.initialize_app()

# the url for the darts coming into Dalkey
dartsForDalkey = "https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByNameXML?StationDesc=Dalkey"

# make the function available so that the webpage can call it through Firebase
@https_fn.on_call(invoker="public")
# pass the login info to the function
def dalkey_train_update(request: https_fn.CallableRequest):
    if request.auth is None:
        # stop the function and throw the error if there are no login details
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="You have to sign in before getting the train data"
        )
    DART_database = firestore.client()
    # fetch the train data at Dalkey with a timeout to stop stalls
    resultsForDalkey = requests.get(dartsForDalkey, timeout=15)
    # stop if the API returns an error
    resultsForDalkey.raise_for_status()
    # convert the text to text that is parsable by python 
    pythonText = ET.fromstring(resultsForDalkey.text)
    
    all_trains = []
    # loop through every important section in the train and add it to the current trains dict
    for current_train in pythonText.findall("{*}objStationData"):
        train_recordings = {
            "train_code": current_train.findtext("{*}Traincode"),
            "train_direction": current_train.findtext("{*}Direction"),
            "due_in_minutes": current_train.findtext("{*}Duein"),
            "minutes_late": current_train.findtext("{*}Late"),
            "time_of_recording": current_train.findtext("{*}Servertime"),
            "train_date": current_train.findtext("{*}Traindate")
        }
        all_trains.append(train_recordings)
    
    print(all_trains)
    # upload the info to dalkey station's database in firebase 
    DART_database.collection("stations").document("Dalkey").collection("train_updates").add({
        "recorded_at": firestore.SERVER_TIMESTAMP,
        "train_results": all_trains
    })
    return {"Train data updated": True}


# run the function when any user starts a journey
@firestore_fn.on_document_created(document="users/{user_id}/journeys/{journey_id}")
def save_journey_timetable(current_journey):
    # stop running if there is no journey doc
    if current_journey.data is None:
        return
    # get the journey that started the function and put the info into a dictionary 
    journey_document = current_journey.data.reference
    journey = journey_document.get().to_dict()
    # dont allow the same journey to trigger the function twice
    if journey.get("timetable_status") == "ready":
        return

    try:
        train_code = journey["train_code"].strip()
        service_date = journey["service_date"].strip()

        # get the train timetable for the correct train using the code and at that service time 
        train_timetable_response = requests.get("https://api.irishrail.ie/realtime/realtime.asmx/getTrainMovementsXML", params={"TrainId": train_code, "TrainDate": service_date}, timeout = 30)
        # stop if the API returns an error
        train_timetable_response.raise_for_status()

        # convert the text to text that is parsable by python 
        pythonText = ET.fromstring(train_timetable_response.text)
        timetable = []
        # loop through every station in the timetable
        for station in pythonText.findall("{*}objTrainMovements"):
            # add all of the important information to the timetable array
            timetable.append({
                "station_code": station.findtext("{*}LocationCode"),
                "station_name": station.findtext("{*}LocationFullName"),
                "station_order": int(station.findtext("{*}LocationOrder")),
                "station_type": station.findtext("{*}LocationType"),
                "scheduled_arrival": station.findtext("{*}ScheduledArrival"),
                "scheduled_departure": station.findtext("{*}ScheduledDeparture"),
                "expected_arrival": station.findtext("{*}ExpectedArrival"),
                "expected_departure": station.findtext("{*}ExpectedDeparture"),
            })

        # timetable is empty then throw an error
        if len(timetable) == 0:
            raise ValueError("there was no timetable found for that date and time")

        # add all of the important data to the journey document
        journey_document.update({
            "timetable": timetable,
            "timetable_status": "ready",
            "timetable_saved_at": firestore.SERVER_TIMESTAMP,
            "timetable_potential_error": ""
        })
    # throw error in firebase if this does not work
    except Exception as error:
        print("Could not save timetable:", error)
        journey_document.update({
            "timetable_status": "error",
            "timetable_potential_error": str(error)
        })


def get_station_coordinates():
    # get the train timetable for the correct train using the code and at that service time 
    station_values = requests.get("https://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML", timeout = 30)
    # stop if the API returns an error
    station_values.raise_for_status()
    # convert the text to text that is parsable by python 
    pythonText = ET.fromstring(station_values.text)

    station_coordinates = {}

    # loop through every station to get it's values
    for station in pythonText.findall("{*}objStation"):
        # get the station code so that the coordinates can be called from it 
        station_name = station.findtext("{*}StationDesc").strip()
        # let the station name function call equal the latitude and longitude 
        station_coordinates[station_name] = {
            "latitude": float(station.findtext("{*}StationLatitude")),
            "longitude": float(station.findtext("{*}StationLongitude"))
        }
    return station_coordinates

def distance_from_location_to_station(gps_latitude, gps_longitude, station_latitude, station_longitude):
    # there is about 111,293 meters in a degree of latitude in dublin
    vertical_meters = (gps_latitude - station_latitude) * 111293
    # there is about 66,593 meters in a degree of longitude in dublin
    horizontal_meters = (gps_longitude - station_longitude) * 66593
    # pythogrous theorm for the shortest length between 2 lines
    distance = math.sqrt((vertical_meters ** 2) + (horizontal_meters ** 2))
    return distance

def estimate_station_arrival_time(recordings, station_latitude, station_longitude):
    # sort the recordings on the time element 
    recordings = sorted(recordings, key=lambda recording: recording["time"])

    arrival_time = None
    previous_time = None
    for recording in recordings:
        recording_time = recording["time"]
        # if the readings are more than 3 seconds apart dont take this gap in readings as a stop
        if (previous_time is not None) and ((recording_time - previous_time) > 3000):
            arrival_time = None
        previous_time = recording_time

        recording_accuracy = recording.get("accuracy_m")
        recording_speed = recording.get("speed_mps")
        # if the accuracy or the speed is missing or if the accuracy is not good enough restart the check
        if ((recording_accuracy is None) or (recording_accuracy > 50) or (recording_speed is None)):
            arrival_time = None
            continue

        # get the distance of the recording from the station
        distance_from_station = distance_from_location_to_station(recording["latitude"], recording["longitude"], station_latitude, station_longitude)

        # if the reading is within 200 meters of the station and the train is moving below 1 meter per second
        if (distance_from_station <= 200) and (0 <= recording_speed <= 1):
            # the possible start time of the stop
            if arrival_time is None:
                arrival_time = recording_time

            # if the stop happens for more than 5 seconds return the recorded start time of the stop 
            if recording_time - arrival_time >= 5000:
                return arrival_time

        else:
            arrival_time = None
    return None


# allow the webpage to call the data from firebase for analysis
@https_fn.on_call(invoker="public")
def analyse_journey(request: https_fn.CallableRequest):
    if request.auth is None:
        # stop the function and throw the error if there are no login details
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="You have to sign in before getting the train data"
        )
    # read in the ID of the train journey
    request_values = request.data
    # stop if the journey ID is not sent in the right format
    if not isinstance(request_values, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="The journey ID is not valid for analysis"
        )
    journey_id = request_values.get("journey_id")
    DART_database = firestore.client()
    # get the correct journey from the right user and using the right ID
    journey_document = (DART_database.collection("users").document(request.auth.uid).collection("journeys").document(journey_id))
    # read in the correct journeys data
    journey = journey_document.get().to_dict()
    # throw an error if there is no data in the journey
    if journey is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="There is no data found that corresponds to this journey"
        )

    # throw an error if the timetable did not save properly in the firestore database 
    if journey.get("timetable_status") != "ready":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="The dart timetable corresponding to this journey did not save properly"
        )

    # loop through the individual documents of recordings in the journey and add it as append then in dictionary form to the gps_recording array
    gps_recordings = []
    for recording_document in journey_document.collection("recordings").stream():
        gps_recordings.append(recording_document.to_dict())
    
    # throw an error if none of the gps recordings were recorded
    if (len(gps_recordings) == 0):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="The GPS recordings have not been saved for this journey"
        )

    timetable = journey["timetable"]

    dalkey_position_in_timetable = None
    pearse_position_in_timetable = None
    # get the ordered postion in the timetable for both dalkey and pearse station
    for station in timetable:
        if station["station_code"].strip() == "DLKEY":
            dalkey_position_in_timetable = station["station_order"]
        if station["station_code"].strip() == "PERSE":
            pearse_position_in_timetable = station["station_order"]

    # throw an error if the table is not showing correctly and going northbound from Dalkey to Pearse
    if ((dalkey_position_in_timetable is None) or (pearse_position_in_timetable is None) or (dalkey_position_in_timetable >= pearse_position_in_timetable)):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="this timetable is not correct and is not a journey running from dalkey to pearse"
        )

    station_coordinates = get_station_coordinates()
    irish_timezone = timezone.utc
    final_results = []

    for station in timetable:
        # only take into account stations between dalkey and pearse
        if not dalkey_position_in_timetable <= station["station_order"] <= pearse_position_in_timetable:
            continue
        # dont take into account any timing checkpoints that are not railway stations
        if station["station_type"] == "T":
            continue

        station_name = station["station_name"].strip()
        # fill in all of the fields we already can 
        result = {
            "station_name": station_name,
            "scheduled_arrival": station["scheduled_arrival"],
            "estimated_arrival": None,
            "delay_minutes": None,
            "status": "not_detected"
        }
        
        # get the coordinates of the station using its name
        coordinates = station_coordinates.get(station_name)

        if coordinates is None:
            result["status"] = "the_station_coordinates_are_missing"

        else:
            arrival_time = estimate_station_arrival_time(gps_recordings, coordinates["latitude"], coordinates["longitude"])

            if arrival_time is not None:
                # converts the arrival time into seconds and then into the irish date and time 
                arrival_datetime = datetime.fromtimestamp((arrival_time/1000), tz=irish_timezone)
                # load in the estimated arrival time formatted and then set the status of the arrival to detected 
                result["estimated_arrival"] = arrival_datetime.strftime("%H:%M:%S")
                result["status"] = "detected"

                scheduled_time = station["scheduled_arrival"]
                # get the delay when there is a real and useul scheduleed time 
                if scheduled_time and scheduled_time != "00:00:00":
                    # combine the date and the time to get the fully formatted irish date time
                    scheduled_datetime = datetime.strptime(journey["service_date"].strip() + " " + scheduled_time, "%d %b %Y %H:%M:%S").replace(tzinfo=irish_timezone)

                    # get the delay in seconds of the dart where if this value is positive that means its late and if it is negative that means that it is early
                    delay_in_seconds = arrival_datetime.timestamp() - scheduled_datetime.timestamp()
                    # the delay in minutes of the dart to a decimal place
                    result["delay_minutes"] = round(delay_in_seconds / 60, 1)

        final_results.append(result)

    # save the analysis in the journey's fields 
    journey_document.update({
        "analysis_results": final_results,
        "analysis_status": "is_analyzed",
        "analysed_at": firestore.SERVER_TIMESTAMP
    })

    # return the results for the webpage
    return {"results": final_results}


