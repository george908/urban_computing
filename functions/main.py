
import requests
import xml.etree.ElementTree as ET
import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn, firestore_fn

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


