var url = process.argv[2];
var appName = process.argv[3];
var instanceId = process.argv[4];

const { initialize, isEnabled } = require('unleash-client');
const instance = initialize({
    url: url,
    appName: appName,
    instanceId: instanceId,
});

const intervalMs = 5000;
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 80 });

var monitoredFlags = {};

function sendFlagState(flagName, interval) {
	var enabled = isEnabled(flagName);
	console.log('send state: %s', flagName + ' ' + enabled);
	for(let i = monitoredFlags[flagName].length - 1; i >= 0; i--) {
		try {
			if(monitoredFlags[flagName][i].readyState == 1) {
				monitoredFlags[flagName][i].send(flagName + ' ' + enabled);			
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

function monitorFeatureFlag(flagName, ws) {
	if(!monitoredFlags[flagName]) {
		monitoredFlags[flagName] = [];
		console.log('start monitor: %s', flagName);
		var interval = setInterval(() => {
			if(instance.client) {
				sendFlagState(flagName, interval);
			} else {
				instance.on('ready', clientData => sendFlagState(flagName, interval));
			}
		}, intervalMs);
	}
	// this could probably be optimized if we have many connections
	if(!monitoredFlags[flagName].includes(ws)) {
		monitoredFlags[flagName].push(ws);
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
instance.on('error', console.error);
instance.on('warn', console.warn);
//instance.on('ready', console.log);

// metrics hooks
//instance.on('registered', clientData => console.log('hey wawa ' + instance.client + ' ' + isEnabled('test-feature-flag')));
//instance.on('ready', clientData => console.log('hey wawa ' + instance.client + ' ' + isEnabled('test-feature-flag')));
//instance.on('sent', payload => console.log('metrics bucket/payload sent', payload));
//instance.on('count', (name, enabled) => console.log(`isEnabled(${name}) returned ${enabled}`));


console.log(process.argv);