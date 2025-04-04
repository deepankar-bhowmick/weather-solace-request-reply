import MessageBox from 'sap/m/MessageBox';
import MessageToast from 'sap/m/MessageToast';
import Table from 'sap/m/Table';
import Event from 'sap/ui/base/Event';
import Controller from 'sap/ui/core/mvc/Controller';
import JSONModel from 'sap/ui/model/json/JSONModel';
import GeoMap from 'sap/ui/vbm/GeoMap';
import * as solace from 'solclientjs';
import { SolaceConnection } from './solace';
import Switch from 'sap/m/Switch';
import { v4 } from 'uuid';
import Dialog from 'sap/m/Dialog';
import Button from 'sap/m/Button';
import Text from 'sap/m/Text';
/**
 * @namespace com.sap.aem.sapaemdemo.controller
 */
type WEATHER = {
    key: string,
    latitude: string,
    longitude: string,
    temperature?: string,
    weather?: string
};

export default class View extends Controller {
    weather: WEATHER[] = []
    session: solace.Session
    /*eslint-disable @typescript-eslint/no-empty-function*/
    public onInit(): void {
        if (navigator.geolocation) {
            navigator.geolocation
                .getCurrentPosition((position: GeolocationPosition) => {
                    (this.getView()?.byId('map') as GeoMap)
                        .setMapConfiguration({
                            "MapProvider": [{
                                "name": "HEREMAPS",
                                "type": "",
                                "description": "HERE Maps",
                                "tileX": "256",
                                "tileY": "256",
                                "maxLOD": "20",
                                "copyright": "Tiles Courtesy of HERE Maps",
                                "Source": [{
                                    "id": "s1",
                                    "url": `https://${SolaceConnection.hereMapAPI}&apiKey=${SolaceConnection.hereMapAPIKey}`
                                }
                                ]
                            }],
                            "MapLayerStacks": [{
                                "name": "DEFAULT",
                                "MapLayer": {
                                    "name": "layer1",
                                    "refMapProvider": "HEREMAPS",
                                    "opacity": "1.0",
                                    "colBkgnd": "RGB(255,255,255)"
                                }
                            }]
                        })
                        .setRefMapLayerStack("DEFAULT")
                        .setCenterPosition(`${position.coords.longitude};${position.coords.latitude}`)
                })
        }
        this.changePersistence()
    }
    public connectDisconnet(event: Event): void {
        //@ts-ignore
        if (event.getParameter('pressed')) {

        }
    }
    public changePersistence(): void {
        if ((this.byId('method') as Switch).getState()) {
            //Unsubscribe from direct session.
            if (this.session) {
                this.session.unsubscribe(solace.SolclientFactory.createTopicDestination('direct/coordinates'),
                    false,
                    undefined,
                    undefined)
            }
            //@ts-ignore
            this.session = solace.SolclientFactory.init({
                logLevel: solace.LogLevel.INFO,
                profile: solace.SolclientFactoryProfiles.version10_5
            }).createSession({
                url: SolaceConnection.url,
                vpnName: SolaceConnection.vpn,
                userName: SolaceConnection.userName,
                password: SolaceConnection.passWord,
                reconnectRetries: 0
            })
            this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (error: solace.OperationError) => {
                MessageBox.error(error.message)
            })
                .on(solace.SessionEventCode.DOWN_ERROR, () => {
                    MessageBox.error('Solace session cannot be created')
                })
                .on(solace.SessionEventCode.MESSAGE, (message: solace.Message) => {
                    this.getWeather(message)
                        .then((weather: WEATHER) => {
                            const reply: solace.Message = solace.SolclientFactory.createMessage()
                            reply.setBinaryAttachment(JSON.stringify(weather))
                            this.session.sendReply(message, reply)
                        })
                })
                .on(solace.SessionEventCode.UP_NOTICE, () => {
                    //Topic consumer.
                    this.session.subscribe(solace.SolclientFactory.createTopicDestination('direct/coordinates'),
                        true,
                        null,
                        10000)
                    MessageToast.show('Solace broker connected (in direct messaging).')
                })
                .connect()
        }
        else {
            if (this.session) {
                //Disconnect from persistent session.
                this.session.disconnect()
            }
            //@ts-ignore
            this.session = solace.SolclientFactory.init({
                logLevel: solace.LogLevel.INFO,
                profile: solace.SolclientFactoryProfiles.version10_5
            }).createSession({
                url: SolaceConnection.url,
                vpnName: SolaceConnection.vpn,
                userName: SolaceConnection.userName,
                password: SolaceConnection.passWord,
                reconnectRetries: 0
            })
            this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (error: solace.OperationError) => {
                MessageBox.error(error.message)
            })
                .on(solace.SessionEventCode.DOWN_ERROR, () => {
                    MessageBox.error('Solace session cannot be created')
                })
                .on(solace.SessionEventCode.UP_NOTICE, () => {
                    //Queue consumer.
                    let coordinatesConsumer: solace.MessageConsumer = this.session.createMessageConsumer({
                        queueDescriptor: {
                            name: SolaceConnection.coordinateQueueName,
                            type: solace.QueueType.QUEUE
                        },
                        connectAttempts: 1,
                        acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT
                    })
                        .on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
                            this.getWeather(message)
                                .then((weather: WEATHER) => {
                                    const message_: solace.Message = solace.SolclientFactory.createMessage()
                                    message_.setDestination(message.getReplyTo()!)
                                    message_.setBinaryAttachment(JSON.stringify(weather))
                                    message_.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT)
                                    message_.setSenderTimestamp(new Date().getTime())
                                    this.session.send(message_)
                                    message.acknowledge()
                                })
                        })
                    coordinatesConsumer.connect()

                    //Weather queue.
                    let weatherConsumer = this.session.createMessageConsumer({
                        queueDescriptor: {
                            name: SolaceConnection.weatherQueueName,
                            type: solace.QueueType.QUEUE
                        },
                        connectAttempts: 1,
                        acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT
                    })
                        .on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
                            const weather: WEATHER = JSON.parse(message.getBinaryAttachment() as string)
                            this.weather.forEach((weather_: WEATHER) => {
                                if (weather_.key === weather.key) {
                                    weather_.temperature = weather.temperature
                                    weather_.weather = weather.weather
                                }
                            });
                            (this.byId('weather') as Table)
                                .setModel(new JSONModel(this.weather), 'local');
                            ((this.byId('weather') as Table)
                                .getModel('local') as JSONModel)
                                .refresh()
                            message.acknowledge()
                        })
                    weatherConsumer.connect();
                    MessageToast.show('Solace broker connected (in guaranteed messaging).')
                })
                .connect()
        }
    }
    public sendCoordinate(event: Event): void {
        //@ts-ignore
        const [longitude, latitude] = event.getParameter('pos').split(';'),
            message: solace.Message = solace.SolclientFactory.createMessage(),
            uuid = v4();
        (event.getSource() as GeoMap).setCenterPosition(`${longitude};${latitude}`),
            (event.getSource() as GeoMap).setBusy(true)
        if (this.session) {
            if ((this.byId('method') as Switch).getState()) {
                message.setDestination(solace.SolclientFactory.createTopicDestination('direct/coordinates'))
                message.setBinaryAttachment(JSON.stringify({
                    'key': uuid,
                    'latitude': parseFloat(latitude).toFixed(4),
                    'longitude': parseFloat(longitude).toFixed(4)
                }))
                message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT)
                this.session.sendRequest(message,
                    10000,
                    (session: solace.Session, message: solace.Message) => {
                        const weather: WEATHER = JSON.parse(message.getBinaryAttachment() as string)
                        this.weather.forEach((weather_: WEATHER) => {
                            if (weather_.key === weather.key) {
                                weather_.temperature = weather.temperature
                                weather_.weather = weather.weather
                            }
                        });
                        (this.byId('weather') as Table)
                            .setModel(new JSONModel(this.weather), 'local');
                        ((this.byId('weather') as Table)
                            .getModel('local') as JSONModel)
                            .refresh()
                    })
            }
            else {
                //Send the coordinates to Solace.
                message.setDestination(solace.SolclientFactory.createTopicDestination(SolaceConnection.coordinateDurabeTopicName))
                message.setBinaryAttachment(JSON.stringify({
                    'key': uuid,
                    'latitude': parseFloat(latitude).toFixed(4),
                    'longitude': parseFloat(longitude).toFixed(4)
                }))
                message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT)
                message.setReplyTo(solace.SolclientFactory.createDurableQueueDestination(SolaceConnection.weatherQueueName))
                this.session.send(message)
            }
            //Add this coordinates to the table.
            this.weather.push({
                key: uuid,
                latitude: parseFloat(latitude).toFixed(4),
                longitude: parseFloat(longitude).toFixed(4)
            });
            if (((this.byId('weather') as Table)
                .getModel('local') as JSONModel)) {
                ((this.byId('weather') as Table)
                    .getModel('local') as JSONModel)
                    .setData(this.weather)
            }
            else {
                (this.byId('weather') as Table)
                    .setModel(new JSONModel(this.weather), 'local')
            }
            ((this.byId('weather') as Table)
                .getModel('local') as JSONModel)
                .refresh()
            MessageToast.show('Message sent successfully');
            (event.getSource() as GeoMap).setBusy(false)
        }
        else {
            MessageBox.error('Solace session cannot be created')
        }
    }
    private getWeather(message: solace.Message): Promise<WEATHER> {
        const coordinate: WEATHER = JSON.parse(message.getBinaryAttachment() as string)

        //Get the temperature of the coordinates.
        return fetch(`${SolaceConnection.mateoAPI}?latitude=${coordinate.latitude}&longitude=${coordinate.longitude}&hourly=temperature_2m,weather_code&forecast_days=1`)
            .then((value: Response) => {
                return value.json()
            }).then((mateo: any) => {
                const avgTemperature: number = (Array.from(mateo.hourly.temperature_2m).reduce((a: any, b: any) => {
                    return a + b
                }) as number) / Array.from(mateo.hourly.temperature_2m).length,
                    weatherCode: number = Array.from(mateo.hourly.weather_code).reduce((a: any, b: any) => {
                        if (a > b) {
                            return a
                        }
                        else {
                            return b
                        }
                    }) as number
                return {
                    'key': coordinate.key,
                    'latitude': coordinate.latitude,
                    'longitude': coordinate.longitude,
                    'temperature': avgTemperature.toFixed(2),
                    'weather': sap.ui.require.toUrl(`com/sap/aem/sapaemdemo/wmo/${weatherCode}.png`)
                }
            })
    }
    public clearWeather(): void {
        new Dialog({
            title: 'Delete?',
            icon: 'sap-icon://delete',
            content: [new Text({
                text: 'All the weather will be deleted. Confirm?'
            }).addStyleClass('sapUiTinyMargin')],
            buttons: [new Button({
                text: 'Yes',
                icon: 'sap-icon://accept',
                press: (event: Event) => {
                    if ((this.byId('weather')?.getModel('local') as JSONModel) != null) {
                        (this.byId('weather')?.getModel('local') as JSONModel).setData({});
                        (this.byId('weather')?.getModel('local') as JSONModel).refresh()
                    }
                    (event.getSource().getEventingParent() as Dialog).close()
                }
            }),
            new Button({
                text: 'No',
                icon: 'sap-icon://decline',
                press: (event: Event) => {
                    (event.getSource().getEventingParent() as Dialog).close()
                }
            })]
        }).open()
    }
}