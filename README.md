# PTRANSIT 
This project aims to provide schedules and real-time updates for most public transit modes in the Lisbon metropolitan area, joining the miscellaneous information provided by the different operators into a single, unified API.

While most operators provide information about schedules, stops and lines using the widely adopted [GTFS](https://gtfs.org/) standard, only some provide real-time updates using [GTFS Realtime](https://gtfs.org/documentation/realtime/reference/) (Carris Metropolitana and Carris)

The remainder operators either use internally designed APIs (Metro de Lisboa, CP) or provide no real-time information at all (Fertagus and Metro Sul do Tejo)

The project features: 
- A unified API that provides schedules and real-time updates for most public transit modes in the Lisbon metropolitan area.
- A web application that allows users to view schedules and real-time updates for public transit in Lisbon.

## Currently supported operators

🟢 Operator provides real-time updates to schedules either through 

🟡 While operator does not provide realtime, we obtain it through indirect means (integration with other services, scraping, etc.), making the information less reliable

🟠 No way to obtain real-time information for this operator

| Operator | Real-time updates | Notes |
| --- | --- | --- |
| Metro de Lisboa | 🟢 | Real-time departure times provided through internal API|
| Carris Metropolitana | 🟢 | Provides real-time updates through GTFS Realtime  + internal API|
| Carris | 🟢 | Provides real-time updates through GTFS Realtime (vehicle locations), we use information|
|Comboios Portugal | 🟢 | Real-time updates provided through internal API|
|Fertagus | 🟡 | Real-time updates obtained from Infraestruturas de Portugal (Rail infrastructure maintainer). Only delays >5min or cancelations are reported. First departures information does not contain real-time information, as requests to IP take 14s to complete (💥) 
| Metro Sul do Tejo | 🟠 | No real-time information available (shame as delays are not infrequent) |


## Web application - available [here](https://transit.paulico.eu)

| Map view on start | Search for stops | Depatures for a stop |
|-------|----|-----|
|![](/assets/images/1.png) |![](/assets/images/3.png) | ![](/assets/images/2.png) |



Map based application that lays out the stops using a colour coding scheme to indicate the stop's operator. Allows user to search for stops, showing the lines that pass through the stop, simplifying the process of finding the right stop (as many stops in Lisbon have very similar names). 

Clicking on a stop, whether on the map or in the search results, shows upcoming departures, including real-time updates when available.

For each departure, the application shows the scheduled departure time, or the real-time updated departure time, if available. When possible, we are able to report whether the vehicle has passed the stop (depatured time is striken through), whether the trip is cancelled (depature time is striken through and marked with a red icon), the platform where the vehicle is expected to arrive (in case of trains), and the vehicle's expected occupancy level.

Since the web app uses React Router, users are able to share links to specific stops or save them as bookmarks for quicker access.


## Roadmap
- [ ] Adding support for Transtejo-Soflusa (ferries operator), MobiCascais (cascais area bus operator) and TCB (Barreiro area bus operator)
- [ ] Color matching the lines with the operator's branding (currently all lines are shown in red) allowing for quicker identification of the line
- [ ] When selecting a depature, show the vehicle and the shape of the trip on the map, allowing users to see where the vehicle is in real-time and how far it is from the stop.
- [ ] Adding support for alerts - informations issued by the operators about service disruptions or modifications to the service - when viewing stops or lines alert information will be shown, allowing users to plan their trips accordingly.

## Disclaimer 
I'm not responsible for any information provided by the operators, and I cannot guarantee that the information is accurate or up-to-date. I created this project for personal use (no i don't want to install 10 apps for 10 different operators, and don't want to pay for a transit app subscription, something that should be free and provided by the operators themselves). I decided to make it public in case it is useful to anyone else.




