
import requests
import xml.etree.ElementTree as ET
import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn

firebase_admin.initialize_app()
DART_database = firestore.client()

# the url for the darts coming into Dalkey
dartsForDalkey = "https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByNameXML?StationDesc=Dalkey"

# make the function available so that the webpage can call it through Firebase
@https_fn.on_call()
# pass the login info to the function
def dalkey_train_update(request: https_fn.CallableRequest):
    if request.auth is None:
        # stop the function and throw the error if there are no login details
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="You have to sign in before getting the train data"
        )
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


