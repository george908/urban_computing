
const firebase_authentication = firebase.auth();
const login_page = document.getElementById("login_with_Google");
const main_page = document.getElementById("on_main_page");
const login_button = document.getElementById("login_button");
const firestore_database = firebase.firestore();

// check if the user is logged in and hide the login page if they are or hide the main page if the arent
firebase_authentication.onAuthStateChanged(function(current_user) {
    login_page.hidden = (current_user !== null);
    main_page.hidden = (current_user === null);
});

// get the google authentication popup to login to the main page
login_button.addEventListener("click", function() {
    const google_auth = new firebase.auth.GoogleAuthProvider();
    firebase_authentication.signInWithPopup(google_auth).catch(function(error) {
        console.error(error);
        document.getElementById("the_login_error").textContent = error.message;
    });
});

let current_journey_recording = null;
let journey_created = null;
// function to record the journey into the firebase database when the start button is pressed 
function start_recording_journey() {
    // dont make a new journey if there is one already going
    if (current_journey_recording !== null) {
        return false;
    }
    // make sure that the user is logged in properly so the database doesnt log no user or a garbage user
    const current_user = firebase_authentication.currentUser;
    if (current_user === null ){
        console.error("you are not logged in correctly");
        return false;
    }
    // get the user's folder
    const current_users_folder = firestore_database.collection("users").doc(current_user.uid);
    // make a new journey with a unique ID
    current_journey_recording = current_users_folder.collection("journeys").doc();
    const new_journey = current_journey_recording;

    // get there email so that it is in the users folder 
    journey_created = current_users_folder.set({email: current_user.email}, {merge: true}).then(function() {
        // get the start time of the journey to add to the top of the doc
        return new_journey.set({started_at: firebase.firestore.FieldValue.serverTimestamp()});
    });
    return true;
}


