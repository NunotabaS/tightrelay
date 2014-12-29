var config = require('./config.js');
var socks = require('./lib/socks');

var socksSrv = socks(config.local);
socksSrv.on('error', function(e){
	if(e.code === 'EADDRINUSE'){
		if(!config.local || !config.local.port){
			console.log('!ERR "local" field not configured in conf.js. Using default port 3000.');
		}
		console.log('!ERR Address in use. Make sure the local port ' + (config.local ? config.local.port : 3000) + ' is free.');
		process.exit(1);
	}s
});
