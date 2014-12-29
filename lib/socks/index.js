var net = require('net');

module.exports = function(config){
	var conf = config.port ? config : {'port':3000, 'host':null};
	var srv = net.createServer();
	
	var clients = [], lastId = 0;
	
	srv.on('connection',function(sock){
		var client = {
			'socket':sock,
			'state':'PREINIT',
			'remote':null,
			'id': lastId++,
		};
		clients.push(client);
		console.log('CONN ' + sock.remoteAddress + ':' + sock.remotePort + ' @' + client.id + ' [' + clients.length + ']');
		
		
		sock.on('data', function(data){
			switch(client.state){
				case 'PREINIT':{
					if(data.length < 2){
						console.log('!ERR Request Too Short @' + client.id);
						client.socket.destroy();
						return;
					}
					if(data[0] !== 5){
						console.log('!ERR Unsupported SOCKS version @' + client.id + ': forcing close.');
						client.socket.destroy();
						return;
					}
					if(data[1] < 1){
						var bufResponse = new Buffer([5,255]);
						console.log('!ERR No authentication methods offered!');
						client.socket.write(bufResponse);
						return;
					}
					var numAuth = data[1];
					var proto = [];
					for(var i = 2; i < Math.min(numAuth + 2, data.length); i++){
						proto.push(data[i]);
					}
					if(proto.indexOf(0) < 0){
						var bufResponse = new Buffer([5,255]);
						console.log('!ERR Client does not offer no-auth login!');
						client.socket.write(bufResponse);
						return;
					} else {
						var bufResponse = new Buffer([5,0]);
						client.state = 'READY';
						console.log('SUCC @' + client.id + ' authenticated');
						client.socket.write(bufResponse);
						return;
					}
				}break;
				case 'READY':{
					if(data.length < 4){
						console.log('!ERR Request Too Short @' + client.id);
						var bufResponse = new Buffer([
							5,7,0,1,0,0,0,0,0,0
						]);
						client.socket.write(bufResponse);
						return;
					}
					if(data[0] !== 5){
						console.log('!ERR Unsupported SOCKS Version @' + client.id + ': forcing close');
						client.socket.destroy();
						return;
					}
					var code = data[1];
					switch(code){
						case 1:{
							// Test address type
							var connection = {
								'host':null,
								'port':0,
								'socket':null
							};
							var addrType = data[3], nextPtr = 4;
							if(addrType === 1){
								connection.host = data[4] + '.' + data[5] + '.' + data[6] + '.' + data[7];
								nextPtr += 4;
							}else if(addrType === 3){
								connection.host = data.toString('utf8', nextPtr + 1, data[4] + nextPtr + 1);
								nextPtr += data[4] + 1;
							}else if(addrType === 4){
								// IPv6
								connection.host = '';
								nextPtr += 16;
							}else {
								console.log('!ERR Unrecognized address type @' + client.id);
							}
							connection.port = data[nextPtr] * 256 + data[nextPtr + 1];
							console.log('CONN @' + client.id + ' = ' + connection.host + ':' + connection.port);
							// Create connection
							connection.socket = net.connect({
								'port':connection.port, 
								'host':connection.host
							}, function(){
								client.state = 'CONNECTED';
								var resp = [5,0,0];
								// Determine if the remote is ipv4 or ipv6
								var remoteHost = connection.socket.remoteAddress.split('.');
								if(remoteHost.length === 4){
									resp.push(1);
									resp.push(parseInt(remoteHost[0],10),parseInt(remoteHost[1],10),parseInt(remoteHost[2],10),parseInt(remoteHost[3],10));
								} else {
									remoteHost = socket.remoteAddress.split(':');
									if(remoteHost.length === 4){
										resp.push(4);
										resp.push(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
									} else {
										resp.push(1);
										resp.push(0,0,0,0);
									}
								}
								resp.push(Math.floor(connection.socket.remotePort / 256), connection.socket.remotePort % 256);
								var bufResponse = new Buffer(resp);
								client.socket.write(bufResponse);
							});
							connection.socket.on('data', function(data){
								client.socket.write(data);
							});
							connection.socket.on('close', function(){
								// Also close the connection with the client
								client.socket.destroy();
							});
							connection.socket.on('error', function(e){
								console.log('!WAR @' + client.id + ' = ' + client.remote.host + ' ' + e.code);
								client.socket.destroy();
							});
							client.remote = connection;
						}break;
						case 2:
						case 3:{
							console.log('!ERR BIND and UDP not supported @' + client.id);
							var bufResponse = new Buffer([
								5,2,0,1,0,0,0,0,0,0
							]);
							client.socket.write(bufResponse);
							return;
						}break;
						default:{
							console.log('!ERR Unsupported Command @' + client.id);
							var bufResponse = new Buffer([
								5,7,0,1,0,0,0,0,0,0
							]);
							client.socket.write(bufResponse);
							return;
						}break;
					}
				}break;
				case 'CONNECTED':{
					client.remote.socket.write(data);
				}break;
				default:{
					console.log('!ERR Unexpected state for client @' + client.id + ' : forcing close.');
					client.socket.destroy();
				}break;
			}
		});
		
		sock.on('close', function(){
			var index = clients.indexOf(client);
			if(index >= 0){
				clients.splice(index, 1);
			}
			console.log('LEAV @' + client.id + ' [' + clients.length +  ']');
		});
		
		sock.on('error', function(){
			var index = clients.indexOf(client);
			if(index >= 0){
				clients.splice(index, 1);
			}
			console.log('LEAV @' + client.id + ' [' + clients.length +  ']');
		});
	});
	srv.listen(conf.port, conf.host);
	return srv;
};
