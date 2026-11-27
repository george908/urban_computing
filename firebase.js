
const firebase_authentication = firebase.auth();
const login_page = document.getElementById("login_with_Google");
const main_page = document.getElementById("on_main_page");
const login_button = document.getElementById("login_button");
const firestore_database = firebase.firestore();
const train_select = document.getElementById("train_select");
let remembered_train_code = "";
let remembered_train_date = "";
// HTML parts for analysing a journey
const journey_select = document.getElementById("journey_select");
const refresh_journeys_button = document.getElementById("refresh_journeys_button");
const analyse_button = document.getElementById("analyse_button");
const analysis_message = document.getElementById("analysis_message");
const analysis_table = document.getElementById("analysis_table");
const analysis_results_body = document.getElementById("analysis_results_body");
const delay_chart_section = document.getElementById("delay_chart_section");
const delay_chart_area = document.getElementById("delay_chart_area");
let delay_chart = null;

// the train code that the program remembers and that the user can change
train_select.addEventListener("change", function() {
    remembered_train_code = train_select.value;
    if (remembered_train_code === "") {
        remembered_train_date = ""; 
        return; 
    }
    const chosen_train = train_select.options[train_select.selectedIndex];
    remembered_train_date = chosen_train.dataset.trainDate;
});

// check if the user is logged in and hide the login page if they are or hide the main page if the arent
firebase_authentication.onAuthStateChanged(function(current_user) {
    // show the correct page depending on if the user is signed in or not 
    login_page.hidden = (current_user !== null);
    main_page.hidden = (current_user === null);
    if (current_user !== null) {
        load_list_of_trains();
        load_saved_journeys();
        // call the firebase python function to get the live train data
        firebase.functions().httpsCallable("dalkey_train_update")().catch(function(error) {
            console.error("Error when loading the train data:", error);
        });
    }
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
    // the train code of the train selected from the dropdown
    const selected_train_code = remembered_train_code;
    const selected_service_date = remembered_train_date;
    // make sure the user selects a train before recording 
    if (selected_train_code === "") {
        alert("You have to select a train before you start to record");
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
        return new_journey.set({
            started_at: firebase.firestore.FieldValue.serverTimestamp(), 
            train_code: selected_train_code,
            service_date: selected_service_date
        });
    });
    return true;
}

function add_recording_values(position) {
    // only add values if the journey is currently running
    if(current_journey_recording === null){
        return;
    }
    // remember the journey that this GPS reading belongs to 
    const recording_journey = current_journey_recording;
    // when the journey has been created properly add the values from the gps sensor
    journey_created.then(function(){
        return recording_journey.collection("recordings").add({time: position.timestamp, latitude: position.coords.latitude, longitude: position.coords.longitude, speed_mps: position.coords.speed, accuracy_m: position.coords.accuracy});
    }).catch(function(error){
        console.error("GPS upload failed:", error);
    });
}

function load_list_of_trains(){
    // chose the latest train update in the Dalkey database 
    firestore_database.collection("stations").doc("Dalkey").collection("train_updates").orderBy("recorded_at", "desc").limit(1).onSnapshot(function(results) { 
            // only add the last train option and remove the others
            train_select.options.length = 1;
            // if there are no train updates yet wait for the database to update
            if (results.empty) {
                return;
            }
            const latest_set_of_train_data = results.docs[0].data(); // the last document full of the train results 
            // loop through all of the trains and make a dropdown choice for each train 
            for (const train of latest_set_of_train_data.train_results) { 
                const option = document.createElement("option");
                // keep the trains code and date together for the api to the stations that its going to stop at 
                option.value = train.train_code.trim(); 
                option.dataset.trainDate = train.train_date;
                option.textContent = train.train_direction + " - arriving in " + train.due_in_minutes + " minutes";
                train_select.appendChild(option);
            }
        }, function(error) {
            console.error(error);
            train_select.options[0].textContent = "There is an error loading the train data"; 
        });

}

function load_saved_journeys() {
    // get the current users info 
    const current_user = firebase_authentication.currentUser;
    if (current_user === null) {
        return;
    }

    // get rid of the previous options but keep the placeholder
    journey_select.options.length = 1;
    analysis_table.hidden = true;
    delay_chart_section.hidden = true;
    // show the user that the journeys are being loaded 
    analysis_message.textContent = "Loading your journeys...";

    // get all of the user's journeys starting with there most latest journey
    firestore_database.collection("users").doc(current_user.uid).collection("journeys").orderBy("started_at", "desc").get().then(function(results) {
            // make a dropdown option for every saved journey in the users history
            for (const journey_document of results.docs) {
                const journey = journey_document.data();
                const option = document.createElement("option");

                // unique journey ID
                option.value = journey_document.id;
                // convert the timestamp in to the correct format 
                let start_time = "";
                if (journey.started_at) {
                    start_time = journey.started_at.toDate().toLocaleTimeString("en-IE");
                }
                // show the user the date, time and trian code so they can identify the correct journey
                option.textContent = journey.service_date + " — " + start_time + " — " + journey.train_code;
                // add it to the dropdown meny
                journey_select.appendChild(option);
            }

            if (results.empty) {
                analysis_message.textContent = "You have no saved journeys yet";
            } 
            else {
                analysis_message.textContent = "Choose a journey to analyse";
            }
        })
        .catch(function(error) {
            console.error("Could not load any saved journeys:", error);
            analysis_message.textContent = "There is an error in loading saved journeys";
        });
}

// when the user clicks on the refresh journeys button than refresh the journeys
refresh_journeys_button.addEventListener("click", load_saved_journeys);

// when a user clicks on a new journey hide the results of the previous journey
journey_select.addEventListener("change", function() {
    analysis_table.hidden = true;
    delay_chart_section.hidden = true;
    analysis_message.textContent = "";
});

// this function gets the results from the python cloud function and turns it into a 
// displayable HTML table
function display_analysis_results(results) {
    // get rid of the results from previous analysis 
    analysis_results_body.replaceChildren();
    // make a row in the table for every station 
    for (const result of results) {
        // make the row in HTML 
        const row = document.createElement("tr");
        // set the default values for variables
        let estimated_arrival = "Not detected";
        let arrival_status = "Not known";

        if (result.estimated_arrival) {
            estimated_arrival = result.estimated_arrival;
        }

        // change the delay in minutes into a readable message for the user
        if (typeof result.delay_minutes === "number") {
            if (result.delay_minutes > 0) {
                arrival_status = result.delay_minutes.toFixed(1) + " min late";
            } else if (result.delay_minutes < 0) {
                arrival_status = Math.abs(result.delay_minutes).toFixed(1) + " min early";
            } else {
                arrival_status = "On time";
            }
        }

        // the values that will be displayed in a row 
        const values = [result.station_name, result.scheduled_arrival, estimated_arrival, arrival_status];

        // create the four cells within each row 
        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }
        // add the row onto the table 
        analysis_results_body.appendChild(row);
    }
    // make the table visible 
    analysis_table.hidden = false;
}


// when the user calls the analyse button 
analyse_button.addEventListener("click", async function() {
    // get the unique ID of the journey that is selected 
    const journey_id = journey_select.value;
    // throw the error and return if the user has not selected a journey
    if (journey_id === "") {
        analysis_message.textContent = "choose a journey before analysis";
        return;
    }

    // throw the error and return if the user is currently recording a journey
    if (current_journey_recording !== null) {
        analysis_message.textContent = "stop recording before analysing a journey";
        return;
    }

    // while the analysis is running disable the other buttons
    start_button.disabled = true;
    stop_button.disabled = true;
    train_select.disabled = true;
    analyse_button.disabled = true;
    journey_select.disabled = true;
    refresh_journeys_button.disabled = true;
    // hide the previous results and tell the user that the results are underway
    analysis_table.hidden = true;
    delay_chart_section.hidden = true;
    analysis_message.textContent = "Analysing your journey...";

    try {
        // call the python cloud function using the unique ID 
        const response = await firebase.functions().httpsCallable("analyse_journey")({journey_id: journey_id});
        // show the results that the function returns
        display_analysis_results(response.data.results);
        display_delay_chart(response.data.results);
        analysis_message.textContent = "Analysis now complete";
    
    } catch (error) {
        console.error("Analysis failed:", error);
        analysis_message.textContent = "There was an error analysing your journey";
    
    } finally {
        // stop the buttons from being disabled after the analysis 
        start_button.disabled = false;
        stop_button.disabled = false;
        train_select.disabled = false;
        analyse_button.disabled = false;
        journey_select.disabled = false;
        refresh_journeys_button.disabled = false;
    }
}); 

function display_delay_chart(results) {
    // all of the values to plot 
    const station_names = [];
    const station_delays = [];
    const point_colours = [];
    // the max value for the y axis
    let y_axis_limit = 1;

    // loop through the results of the analysis 
    for (const result of results) {
        // add the stations name
        station_names.push(result.station_name);
        // check if a delay in minutes was calculated correctly 
        if (typeof result.delay_minutes === "number") {
            // add the station delays
            station_delays.push(-result.delay_minutes);
            // find the largest delay to set the y axis limit 
            y_axis_limit = Math.max(y_axis_limit, Math.ceil(Math.abs(result.delay_minutes)));
            // make the colour of the graphs points green if it's in the positive and red if it's in the negative 
            if (result.delay_minutes > 0) {
                point_colours.push("red");
            } else if (result.delay_minutes < 0) {
                point_colours.push("green");
            } else {
                point_colours.push("grey");
            }
        } 
        else {
            // make the value nothing if there was no delay in minutes
            station_delays.push(null);
            point_colours.push("grey");
        }
    }

    // get rid of the previous graph if it exists
    if (delay_chart !== null) {
        delay_chart.destroy();
    }
    // display the graph 
    delay_chart_section.hidden = false;
    // draw the line graph
    delay_chart = new Chart(delay_chart_area, {
        type: "line",
        data: {
            labels: station_names,
            datasets: [{
                label: "Delay in minutes",
                data: station_delays,
                pointBackgroundColor: point_colours,
                borderColor: get_graph_line_colour
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Station"
                    }
                },
                y: {
                    min: -y_axis_limit,
                    max: y_axis_limit,
                    title: {
                        display: true,
                        text: "Minutes ahead of schedule"
                    }
                }
            }
        }
    });
}

// make the good results green and the bad red 
function get_graph_line_colour(context) {
    // get the current delay chart
    const current_chart = context.chart;
    // get the area where the data is plotted
    const graph_area = current_chart.chartArea;
    // check if the graph area has been created
    if (!graph_area) {
        return "green";
    }
    // create a colour gradient from the top to the bottom of the graph split by the 0 middle of no delays
    const gradient = current_chart.ctx.createLinearGradient(0, graph_area.top, 0, graph_area.bottom);
    // create a none blended gradient
    gradient.addColorStop(0, "green");
    gradient.addColorStop(0.5, "green");
    gradient.addColorStop(0.5, "red");
    gradient.addColorStop(1, "red");

    return gradient;
}
