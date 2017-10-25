let FtpDeploy = require('ftp-deploy');
let ftpDeploy = new FtpDeploy();

let username = process.argv[2];
let password = process.argv[3];

var config = {
	username: username,
	password: password,
	host: "muxe.org",
	port: 21,
	localRoot: __dirname + "/../dist",
	remoteRoot: "/muxe.org/dist/"
}

ftpDeploy.on('uploading', function(data) {
	console.log('uploading', data.filename, data.percentComplete + '%');
});

ftpDeploy.deploy(config, function(err) {
	if (err) {
		console.log(err);
		process.exit(1);
	}
	console.log('finished deploy');
});
