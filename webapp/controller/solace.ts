export module SolaceConnection {
    export const url: string = '<solace broker host in WSS protocol>', //Enter the wss protocol URL.
        vpn: string = '<solace message VPN>', //Enter message VPN.
        userName: string = '<solace client username>', //Enter client username.
        passWord: string = '<solace password of client username>', //Enter password of client username.
        hereMapAPI: string = 'maps.hereapi.com/v3/base/mc/{LOD}/{X}/{Y}/png8?style=lite.day',
        hereMapAPIKey: string = '<here map API key>', //here map API key
        mateoAPI: string = 'https://api.open-meteo.com/v1/forecast',
        weatherQueueName: string = '<weather queue name>', //Get weather of the coordinates in this queue.
        coordinateQueueName: string = '<coordinates queue name>', //This queue subscribes to the coordinates topic.
        coordinateDurabeTopicName: string = '<coordinates topic name>' //Enter the topic where the coordinates will be sent.
}