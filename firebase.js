
const firebase_authentication = firebase.auth();
const login_page = document.getElementById("login_with_Google");
const main_page = document.getElementById("on_main_page");
const login_button = document.getElementById("login_button");

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
    });
});
