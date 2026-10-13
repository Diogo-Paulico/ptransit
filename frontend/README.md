## Web application - available [here](https://transit.paulico.eu)

| Map view on start | Search for stops | Depatures for a stop |
|-------|----|-----|
|![](/assets/images/1.png) |![](/assets/images/3.png) | ![](/assets/images/2.png) |



Map based application that lays out the stops using a colour coding scheme to indicate the stop's operator. Allows user to search for stops, showing the lines that pass through the stop, simplifying the process of finding the right stop (as many stops in Lisbon have very similar names). 

Clicking on a stop, whether on the map or in the search results, shows upcoming departures, including real-time updates when available.

For each departure, the application shows the scheduled departure time, or the real-time updated departure time, if available. When possible, we are able to report whether the vehicle has passed the stop (depatured time is striken through), whether the trip is cancelled (depature time is striken through and marked with a red icon), the platform where the vehicle is expected to arrive (in case of trains), and the vehicle's expected occupancy level.

Since the web app uses React Router, users are able to share links to specific stops or save them as bookmarks for quicker access.