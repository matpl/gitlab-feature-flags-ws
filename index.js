var url = process.argv[2];
if(!url) {
	console.error('error: first argument should be the unleash url');
	process.exit();
}
var appName = process.argv[3];
if(!appName) {
	console.error('error: second argument should be the unleash appName');
	process.exit();
}
var instanceId = process.argv[4];
if(!instanceId) {
	console.error('error: third argument should be the unleash instanceId');
	process.exit();
}

var intervalMs = 5000;
if(process.argv[5]) {
	intervalMs = process.argv[5];
}

// todo: decouple:
// main and args
// websocket part
//		handles connection and sends data?
//			open server web socket, connected callback and msg callback?
// gitlab feature flag polling

// monitor: instanciate websocket and gives it callback for when a msg happens

// function: open web socket
//		on connection (do nothing on connection other than register on message)
//			on message

// when msg happens
//		monitorFeatureFlag
//			start monitorying flag if it wasnt
//				as well as getting state and putting it in the list
//			send state to client

const { initialize, isEnabled } = require('unleash-client');

class UnleashClient {
	constructor(url, appName, instanceId) {
		this.url = url;
		this.appName = appName;
		this.instandId = instanceId;
	}
	
	initialize() {
		this.instance = initialize({
			url: url,
			appName: appName,
			instanceId: instanceId,
		});
		this.instance.on('error', console.error);
		this.instance.on('warn', console.warn);
	}
	
	async isEnabled(flag) {
		if(!this.instance) {
			this.initialize();
		}
		
		if(this.instance.client) {
			return isEnabled(flag);
		} else {
			return new Promise((res, rej) => {
				this.instance.on('ready', clientData => res());
			}).then(() => {
				return isEnabled(flag);
			});
		}
	}
}

var gitlabStateChecker = new UnleashClient(url, appName, instanceId);



const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 80 });

var monitoredFlags = {};
var flagsState = {};

async function sendFlagState(flagName, interval) {
	var enabled = await gitlabStateChecker.isEnabled(flagName);
	if(flagsState[flagName] === undefined) {
		flagsState[flagName] = enabled;
	}
	if(flagsState[flagName] != enabled) {
		flagsState[flagName] = enabled;
		console.log('send state: %s', flagName + ' ' + enabled);
		for(let i = monitoredFlags[flagName].length - 1; i >= 0; i--) {
			try {
				if(monitoredFlags[flagName][i].readyState == 1) {
					monitoredFlags[flagName][i].send(JSON.stringify({ flag: flagName, state: enabled }));
				} else {
					monitoredFlags[flagName].splice(i, 1);
					if(monitoredFlags[flagName].length == 0) {
						console.log('stop monitor: %s', flagName);
						delete monitoredFlags[flagName];
						clearInterval(interval);
					}
				}
			} catch(error) {
				monitoredFlags[flagName].splice(i, 1);
				if(monitoredFlags[flagName].length == 0) {
					console.log('stop monitor: %s', flagName);
					delete monitoredFlags[flagName];
					clearInterval(interval);
				}
			}
		}
	}
}

async function sendInitial(flagName, ws) {
	var enabled = await gitlabStateChecker.isEnabled(flagName);
	console.log('send initial state: %s', flagName + ' ' + enabled);
	ws.send(JSON.stringify({ flag: flagName, state: enabled }));
}

function monitorFeatureFlag(flagName, ws) {
	if(!monitoredFlags[flagName]) {
		monitoredFlags[flagName] = [];
		console.log('start monitor: %s', flagName);
		var interval = setInterval(() => {
			sendFlagState(flagName, interval);
		}, intervalMs);
	}
	// this could probably be optimized if we have many connections
	if(!monitoredFlags[flagName].includes(ws)) {
		monitoredFlags[flagName].push(ws);
		
		if(ws.readyState == 1) {
			try {
				sendInitial(flagName, ws);
			} catch(error) {
                // do nothing... it's gonna get cleaned anyways				
			}
		}
	}
}

wss.on('connection', function connection(ws) {
  console.log('connection');
  ws.on('message', function incoming(message) {
	if(message) {
		console.log('monitor request: %s', message);
		monitorFeatureFlag(message, ws);
	}
  });
});

// optional events
//instance.on('ready', console.log);

// metrics hooks
//instance.on('registered', clientData => console.log('hey wawa ' + instance.client + ' ' + isEnabled('test-feature-flag')));
//instance.on('ready', clientData => console.log('hey wawa ' + instance.client + ' ' + isEnabled('test-feature-flag')));
//instance.on('sent', payload => console.log('metrics bucket/payload sent', payload));
//instance.on('count', (name, enabled) => console.log(`isEnabled(${name}) returned ${enabled}`));


console.log(process.argv);
