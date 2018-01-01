var LumiBluetooth = (function () {

	// Privates
	var pairedDevices = {};
	var onReceivedDataCallbacks = [];
	var writeCharacteristic;
	var writeBuffer = [];
	var writing = false;
	var napsSinceWrite = 0;

	// Adds a function called when a BLE characteristic changes value.
	// Mutiple callbacks may be added.
	this.addReceivedDataCallback = function (callback) {
		if (writeCharacteristic) {
			writeCharacteristic.addEventListener('characteristicvaluechanged', callback);
			onReceivedDataCallbacks.push({
				key: callback.name,
				value: callback
			})
		}
	}

	// Clears the RecievedDataCallback dictionary.
	this.removeAllReceivedDataCallbacks = function () {
		onReceivedDataCallbacks = [];
	}

	// Searches for Devices based upon Service IDs.  Then prompts
	// a user to select a target device.  Lastly, it conencts to
	// target d evice.
	this.searchAndConnect = function (addSystemText, primaryServicesUUID = "0xFFE0") {
		return new Promise(function (resolve, reject) {
			let optionalServices = primaryServicesUUID
				.split(/, ?/).map(s => s.startsWith('0x') ? parseInt(s) : s)
				.filter(s => s && BluetoothUUID.getService);

			if (addSystemText) {
				addSystemText('Requesting any Bluetooth Device...');
			}
			navigator.bluetooth.requestDevice({
					acceptAllDevices: true,
					optionalServices: optionalServices
				}) // After getting a device
				.then(device => {
					pairedDevices[device.name] = device;
					if (addSystemText) {
						addSystemText('Connecting to GATT Server...');
					}
					return device.gatt.connect();
				}) // After connecting
				.then(server => {
					if (addSystemText) {
						addSystemText('Getting Services...');
					}
					return server.getPrimaryServices();
				}) // After getting services
				.then(services => {

					if (addSystemText) {
						addSystemText("Found services: ");
					}
					services.forEach(service => {
						let queue = Promise.resolve();
						queue = queue.then(_ => service.getCharacteristics().then(characteristics => {
							if (addSystemText) {
								addSystemText('Service: ' + service.uuid);
							}
							characteristics.forEach(characteristic => {
								if (addSystemText) {
									addSystemText('>> Characteristic: ' + characteristic.uuid + ' ' +
										getSupportedProperties(characteristic));
								}
								writeCharacteristic = characteristic;
								if (addSystemText) {
									addSystemText("Write characteristic set");
								}
								writeCharacteristic.startNotifications();
								resolve();
							}); // End enumerating characteristics
						})); // End queue
					}) // End enumerating services
				}). // End Service exploration                   
			catch(error => {
				if (addSystemText) {
					addSystemText(error);
				}
				console.log(error);
			})
		}); // End Search and Connect Promise
	} // End Search and Connect Function

	this.writeString = async function (data, addSystemText = null) {
		write(data, true, addSystemText);
	}

	this.writeData = async function (data, addSystemText = null) {
		write(data, false, addSystemText);
	}

	var write = function (data, string = true, addSystemText = null) {
		p = new Promise(function (resolve, reject) {
			if (pairedDevices) {
				if (writeCharacteristic != null) {
					// Don't double encode.
					if (string) {
						let encoder = new TextEncoder('utf-8');
						var writeData = encoder.encode(data);
						writeBuffer.push.apply(writeBuffer, writeData); // test
						// writeBuffer = appendUint8Buffer(writeBuffer, writeData);
						writeLoop(writeData);
					} else if (data != null){
						writeData = Array.from(data);
						// dataInUint8 = Uint8Array.from(data);
						writeBuffer.push.apply(writeBuffer, writeData);
						// writeBuffer = appendUint8Buffer(writeBuffer, dataInUint8);
						writeLoop(writeData);
					} else {
						resolve();
					}
					resolve();
				} else {
					reject("No write characteristic")
				}
			} else {
				reject("No devices paired.")
			}
		}).catch(error => {
			if (addSystemText) {
				addSystemText("No device paired");
			}
		});
		return p;
	}

	this.disconnectDevice = function () {

	}

	// Important information on write queue
	// https://github.com/WebBluetoothCG/web-bluetooth/issues/188
	// 


	var writeLoop = async function(data){
		// writing = true;
		// for(var i = 0; i < writeBuffer.length; i){
		// 	var length = 0;
		// 	// if(writeBuffer.length < (i + 20)){ length = writeBuffer.length} else { length = i + 20; }
		// 	if(writeBuffer.length < 20){ length = writeBuffer.length; } else { length = 20; }
		// 	var tmpWriteBfr = Uint8Array.from(writeBuffer.splice(0, length));
		// 	console.log(tmpWriteBfr);
		// 	writeCharacteristic.writeValue(tmp=WriteBfr);
		// 	await sleep(42);
		// 	i+=20;
		// }

		// 1. Create a rollback buffer, in case there is an error writing.
		// 2. Check if the buffer is empty.
		// 3. If writing is currently in progress, wait.  But not forever.
		//	  After three naps, assume write is complete.
		// 4. Limit the write to the HM-10 TX buffer (20 bytes)
			// TODO Make the TX buffer size mutable.  For example, the 
			// HM-16 has a TX buffer of 256
		// 5. Cut a chunk off the writeBuffer for writing.
		// 6. Attempt to write the value to the device
		// 7. Once the write is complete, set the writing flag to false.
			// NOTE The write callback doesn't seem to be working.
		// 8. If there is an error restore the buffer.

		var mementoWriteBuffer = [];
		while(writeBuffer.length > 0){
			if(writing === false){
				writing = true;
				var length = 0;
				if(writeBuffer.length < 20){ length = writeBuffer.length; } else { length = 20; }
				mementoWriteBuffer = writeBuffer;
				var tmpWriteBfr = Uint8Array.from(writeBuffer.splice(0, length));
				console.log("TX: " + tmpWriteBfr);
				writeCharacteristic.writeValue(tmpWriteBfr).
				then(blah => {
					writing = false;
				}).catch(error => {
					writeBuffer = mementoWriteBuffer;
					writing = false;
					console.log("BLE Write Error: ");
					console.log(error);
					delayAndWriteAgain();
				});
			} else {
				await bleWriteThrottling(42);
			}
			
		}
		writeBuffer = [];
	}

	var delayAndWriteAgain = function(){
		setTimeout(writeLoop(), 100);
	}

	var bleWriteThrottling = async function(ms){
		// 1. Sleep a bit
		// 2. Count naps
		// 3. Too many naps, then assume BLE writing is done.
		await sleep(ms);
		napsSinceWrite++;
		if(napsSinceWrite > 2){
			writing = false;
			napsSinceWrite = 0;
		}

	}

	/* Utils */
	function getSupportedProperties(characteristic) {
		let supportedProperties = [];
		for (const p in characteristic.properties) {
			if (characteristic.properties[p] === true) {
				supportedProperties.push(p.toUpperCase());
			}
		}
		return '[' + supportedProperties.join(', ') + ']';
	}

	var appendUint8Buffer = function (bufferOne, bufferTwo) {
		if(!bufferOne){return bufferTwo;}
		var tmp = new Uint8Array(bufferOne.byteLength + bufferTwo.byteLength);
		tmp.set(new Uint8Array(bufferOne), 0);
		tmp.set(new Uint8Array(bufferTwo), bufferOne.byteLength)
		return tmp.buffer;
	}

	return {
		addReceivedDataCallback: addReceivedDataCallback,
		searchAndConnect: searchAndConnect,
		writeString: writeString,
		writeData: writeData,
		disconnectDevice: disconnectDevice
	}
})(); // End Proto
