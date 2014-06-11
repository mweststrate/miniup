desc("Built miniup")
task("default", ["miniup.js"])

desc("Built miniup")
file("miniup.js", ["miniup.ts"], { async: true }, function() {
	console.log('Build started');
	//TODO: use tsc from node_modules instead of global!
	jake.exec(["tsc miniup.ts"], {printStdout: true}, function () {
		console.log('Build completed');

		var shellbang = "#!/usr/bin/env node\n"
		var fs = require('fs');
		fs.writeFileSync('miniup-cli.js', shellbang + fs.readFileSync('miniup.js'));

		complete();
	});
})

desc("Test miniup")
task("test", ["miniup.js"], { async: true }, function() {
	console.log('Test started');
	jake.exec(["nodeunit test/base.js"], {printStdout: true, printStderr: true}, function () {
		console.log('Test completed');
		complete();
	});
})


desc("Test coverage miniup")
task("cover", ["miniup.js"], { async: true }, function() {
	console.log('Test started');
	jake.exec(["istanbul cover test/base.js"], {printStdout: true, printStderr: true}, function () {
		console.log('Test completed');
		complete();
	});
})