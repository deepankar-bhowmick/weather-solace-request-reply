# Solace: Advanced messaging pattern using Request-Reply pattern
This weather app developed using SAPUI5 application demonstrates the request-reply messaging pattern in Solace. Both guranteed and direct messaging is implemented.

### How to run
Clone the repository:
`git clone https://github.com/deepankar-bhowmick/sap-aem-request-reply.git`

Install dependencies:
`npm install -all`

### Configure Solace event broker in SAPUI5:
This can be done in the `solace.ts` file:
- `url`: Solace broker URL in WSS protocol.
- `userName`: Solace client username.
- `passWord`: Password of the Solace client username.
- `hereMapAPIKey`: API key from Here-Map. Note, the app can also run without HereMap subscription.
- `weatherQueueName`: Solace queue name which will return the weather details.
- `coordinateQueueName`: Solace queue name which will have the coordinates. This queue must subscribe to the topic below.
- `coordinateDurabeTopicName`: Solace topic where the coordinates will be published.

### Configure Solace event broker:
- Create a solace event broker.
- Create queues for weather and coordinates. The request messages will be sent to the coordinates and the response message will be received in weather.
- Create a topic for publishing the coordinates.
- Subscribe the topic with the coordinates queue.

Build the application:
`npm run build`

Run the application:
`npn run start-noflp`
