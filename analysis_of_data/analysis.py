import pandas as pd 
import matplotlib.pyplot as plt

results = pd.read_csv("GPS_values.csv")

# loop through eveey column in the data and find the number of missing values
print("The missing values are:")
for column in results.columns:
    all_missing_values = results[column].isna()
    missing_values_count = all_missing_values.sum()
    print(column, "-", missing_values_count)

# print out how accurate values are 
print("number of accuracy values is ", len(results["accuracy_m"]))
print("number of accuracy values over 10 meters is ", (results["accuracy_m"] > 10).sum())
print("number of accuracy values over 25 meters is ", (results["accuracy_m"] > 25).sum())
print("number of accuracy values over 50 meters is ", (results["accuracy_m"] > 50).sum())
print("number of accuracy values over 100 meters is ", (results["accuracy_m"] > 100).sum())
print("number of accuracy values over 200 meters is ", (results["accuracy_m"] > 200).sum())


# get the time from unix time into the normal time
results["time"] = pd.to_datetime(results["time"], unit="ms")
# make it kilometers per hour so it makes more sense
results["speed_kmph"] = 3.6*(results["speed_mps"])

# find the differences between back to back times and get the differences into seconds
time_differences_seconds = results["time"].diff()
time_differences_seconds = time_differences_seconds.dt.total_seconds()

print("the average amount of time between readings is ", time_differences_seconds.mean())
print("the amount of gaps in time over 3 seconds is ", (time_differences_seconds > 3).sum())
print("the amount of times that are out of order or duplicates is ", (time_differences_seconds <= 0).sum())


# make the graph and plot out the time and speed
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(results["time"], results["speed_kmph"], color="purple", linewidth=1)

# the axises 
ax.set_xlabel("Time")
ax.set_ylabel("Speed in km/h")

plt.tight_layout()
plt.savefig("page 1")
plt.show()

# make the graph and plot out the time and speed
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(results["time"], results["accuracy_m"], color="purple", linewidth=1)

# the axises 
ax.set_xlabel("Time")
ax.set_ylabel("Accuracy in meters")

plt.tight_layout()
plt.savefig("page 2")
plt.show()


# make the graph and plot out the time and speed
fig, ax = plt.subplots(figsize=(8, 5))
plt.plot(results["longitude"], results["latitude"], marker=".", color="purple", markersize=2)

# the axises 
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")

plt.grid(True)
plt.savefig("page 3")
plt.show()

