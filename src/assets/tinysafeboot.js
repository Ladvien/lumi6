// TODO Read in Hexfile
// TODO Capture display and release
// var string = new TextDecoder().decode(loadedFile.slice(10, 120));

var TinySafeBoot = (function () {

	var self = this;
	var resetPin = 3;

	function TSBDevice(
		deviceName,
		firmwareDate,
		deviceSignature,
		numberOfPages,
		pageSize,
		freeFlash,
		eepromSize,
		readIndex,
	) {
		this.deviceName = deviceName;
		this.firmwareDate = firmwareDate;
		this.deviceSignature = deviceSignature;
		this.numberOfPages = numberOfPages;
		this.pageSize = pageSize;
		this.freeFlash = freeFlash;
		this.eepromSize = eepromSize;
		this.resetReadIndex = function () {
			this.readIndex = 0;
		}
		this.incrementReadIndex = function (increment) {
			previousReadIndex = readIndex;
			readIndex += increment;
		}
		this.readIndex = function () {
			return readIndex;
		}
		this.rewindIndex = function () {
			readIndex = previousReadIndex;
		}
		var readIndex;
		var previousReadIndex;
	};
	var connectedDevice;

	function InstalledProgram(
		programData,
		numberOfPages,
		receivedBuffer
	) {
		this.programData = programData;
		this.numberOfPages = numberOfPages;
		this.receivedBuffer = receivedBuffer;
	}
	var installedProgram;

	function ProgramToInstall(
		programData,
		pagesNeeded,
		programDataByPage,
		writtenPageIndex
	){
		this.programData = programData;
		this.pagesNeeded = pagesNeeded;
		this.programDataByPage = programDataByPage;
		this.writtenPageIndex = writtenPageIndex;
	}
	var programToInstall;

	// Depedency functions
	var receivedData = function () {};
	var writeString = function () {};
	var writeData = function () {};
	var displayText = function () {};
	var onConnectedToTSB = function () {};
	var onFinishedReading = function () {};

	// Used for routing commands on received data.
	var CommandEnum = Object.freeze({
		none: 0,
		handshake: 1,
		uploadInitiated: 2,
		readInitiated: 4,
		waitingReadPage: 5,
		finishedReading: 6,
		waitingForPageRequest: 7,
		waitingOnCompleteWriteConfirmation: 8,
		failed: 9
	});
	var activeCommand = CommandEnum['none'];
	var commandKeys = Object.keys(CommandEnum);

	var startCommandTimeoutTimer = async function (ms) {
		await sleep(ms);
		if (activeCommand !== CommandEnum['none']) {
			activeCommand = CommandEnum['failed'];
			commandRouting();
		}
	}

	// Lets other modules know a TSB command is underway.
	var getControllingSerial = function () {
		return activeCommand !== CommandEnum['none'];
	}

	var sleep = function (ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	this.setHandshakeButton = function (handshakeButton) {
		document.getElementById(handshakeButton).onclick = onHandshakeButtonClick;
	}

	var onHandshakeButtonClick = async function () {
		// TODO: Make reset pin a parameter
		// TODO: Make action timers a parameter

		// HM-1X is set HIGH, LOW, HIGH resetting
		// the Atmega or ATtiny.  Then, TSB handshake is sent.
		activeCommand = CommandEnum['handshake'];
		startCommandTimeoutTimer(3000);
		writeString("AT+PIO" + resetPin + "1");
		await sleep(200);
		writeString("AT+PIO" + resetPin + "0");
		await sleep(1200);
		writeString("AT+PIO" + resetPin + "1");
		await sleep(1200);
		writeString("@@@");
	}

	this.init = function (_receivedData) {
		onReceivedData = receivedData;
	}

	this.setWriteString = function (writeMethod) {
		writeString = writeMethod;
	}

	this.setWriteData = function (writeMethod) {
		writeData = writeMethod;
	}

	this.setDisplayText = function (_displayText) {
		displayText = _displayText;
	}

	this.onReceivedData = function (event) {

		// TODO: Handle received data better.  
		// NOTE: the TX buffer for the HM-1X is only 20 bytes.  
		// But other devices differ.

		var receivedData = new Uint8Array(event.target.value.byteLength);
		for (var i = 0; i < event.target.value.byteLength; i++) {
			receivedData[i] = event.target.value.getUint8(i);
		}
		console.log("RX: " + receivedData);
		if (activeCommand !== CommandEnum['none']) {
			commandRouting(receivedData);
		}
	}

	var commandRouting = function (data) {
		switch (activeCommand) {
			case CommandEnum['none']:
				break;
			case CommandEnum['handshake']:
				handshakeHandling(data);
				break;
			case CommandEnum['uploadInitiated']:
				startUpload();
				break;
			case CommandEnum['readInitiated']:
				addSystemText("Connected device Flash Read Started")
				readInitiated(data);
				break;
			case CommandEnum['waitingReadPage']:
				waitingReadPage(data);
				break;
			case CommandEnum['waitingForPageRequest']:
				writePage(data);
				break;
			case CommandEnum['waitingOnCompleteWriteConfirmation']:

				break;
			case CommandEnum['finishedReading']:
				addSystemText("Completed reading flash: " + installedProgram.programData.length + " bytes read.")
				onFinishedReading();
				activeCommand = CommandEnum['none'];
				break;
			case CommandEnum['failed']:
				// TODO Handle failed
				displayText("Failed command: " + commandKeys[activeCommand]);
				break;
			default:
				break;
		}
	}

	var handshakeHandling = function (data) {

		// 1. Check if handshake was succesful
		// 2. Decode device info.

		// A full handshake reply is 17 bytes.
		var handshakeReplyCheck = new TextDecoder("utf-8").decode(data);
		// ATtiny will reply 'tsb' and Atmega 'TSB'
		var prefixToCheck = handshakeReplyCheck.substring(0, 3)
		// Last character should be "!"
		var confirm = handshakeReplyCheck.substring(16, 17);
		if (handshakeReplyCheck.substring(0, 3) === 'tsb' ||
			handshakeReplyCheck.substring(0, 3) === 'TSB' &&
			data.length > 16 &&
			confirm === '!'
		) {

			activeCommand = CommandEnum['none'];
			displayText(" ");
			// TODO: Display what device by comparing device signature to known devices.

			// Format TSB handshake data
			var firmwareDatePieces = new Uint8Array(2);
			var firmwareStatus = 0x00;
			var signatureBytes = [];
			var pagesizeInWords = 0x00;
			var freeFlash = [];
			var eepromSize = [];

			firmwareDatePieces[0] = data[3];
			firmwareDatePieces[1] = data[4];
			firmwareStatus = data[5];
			signatureBytes[0] = data[6];
			signatureBytes[1] = data[7];
			signatureBytes[2] = data[8];
			pagesizeInWords = data[9];
			freeFlash[0] = data[10];
			freeFlash[1] = data[11];
			eepromSize[0] = data[12];
			eepromSize[1] = data[13];


			//; Current bootloader date coded into 16-bit number
			//.set    YY      =       16
			//.set    MM      =       10
			//.set    DD      =       27
			//.equ    BUILDDATE   = YY * 512 + MM * 32 + DD
			//; YY = Year - MM = Month - DD = Day

			//var test = 16 * 512 + 10 * 32 + 27; // = 0010000 1010 11011 OR 215B
			//     YY     MM   DD
			// Date of firmware
			var dateStamp = firmwareDatePieces[1] << 8 | firmwareDatePieces[0];
			var day = (dateStamp & 0x3F);
			var month = ((dateStamp & 0x3C0) >> 5);
			var year = ((dateStamp & 0xFC00) >> 9);
			var date = ("20" + year + "-" + month + "-" + day);

			// Atmel device signature.
			deviceSignature = toByteString(signatureBytes[0]) + " " +
				toByteString(signatureBytes[1]) + " " +
				toByteString(signatureBytes[2]);

			// TODO: Create a prototype for TSB Device
			// This will be used later
			var combinedDeviceSignature = (((signatureBytes[0] << 16) | signatureBytes[1] << 8) | signatureBytes[2]);

			var deviceName = getDeviceFromSignature(combinedDeviceSignature);

			// The size is in words, make it bytes.
			var pageSize = (pagesizeInWords * 2);

			// Get flash size.
			var flashSize = ((freeFlash[1] << 8) | freeFlash[0]) * 2;
			var numberOfPages = flashSize / pageSize;

			// Get EEPROM size.
			fullEepromSize = ((eepromSize[1] << 8) | eepromSize[0]) + 1;

			activeCommand = CommandEnum['none'];

			connectedDevice = new TSBDevice(deviceName,
				date,
				combinedDeviceSignature,
				numberOfPages,
				pageSize,
				flashSize,
				fullEepromSize,
				0
			)

			displayText("Welcome to Lumi5");
			displayText("TinySafeBoot connected to: " + deviceName);
			displayText(" ");
			displayText("Free Flash: 		" + flashSize);
			displayText("Pages: 			" + pageSize);
			displayText("EEPROM Size: 		" + fullEepromSize);
			displayText("Firmware Date: 	" + date);
			displayText("Device Signature: 	" + deviceSignature);
			displayText("Number of Pages:	" + numberOfPages);

			if (onConnectedToTSB) {
				onConnectedToTSB();
			}
		}
	}

	var readInitiated = function () {
		if(!checkIfConnected()){ return false; }
		installedProgram = new InstalledProgram([], 0, []);
		writeString("f!");
		activeCommand = CommandEnum['waitingReadPage'];
	}

	var waitingReadPage = function (data) {

		var tmpArr = Array.prototype.slice.call(data);
		installedProgram.receivedBuffer.push(...tmpArr);

		// Check the bottom dogear.
		var bfrLength = installedProgram.receivedBuffer.length;

		if (installedProgram.receivedBuffer.length === connectedDevice.pageSize) {
			installedProgram.programData.push(...installedProgram.receivedBuffer);
			installedProgram.numberOfPages++;

			if (installedProgram.receivedBuffer[bfrLength - 3] === 0xFF &&
				installedProgram.receivedBuffer[bfrLength - 2] === 0xFF &&
				installedProgram.receivedBuffer[bfrLength - 1] === 0xFF
			) {
				activeCommand = CommandEnum['finishedReading'];
				commandRouting();
				return;
			}
			// TODO Add callback event to update the UI
			// on each page read from the device
			writeString("!");
			installedProgram.receivedBuffer = [];
		}
	}

	var upload = function (programData) {
		if(!checkIfConnected()){ return false; }
		prepareProgramToInstall(programData);
		activeCommand = CommandEnum['uploadInitiated']
		commandRouting();
	}

	var prepareProgramToInstall = function(programData){
		var pagesNeeded = Math.ceil(programData.length / connectedDevice.pageSize);
		programToInstall = new ProgramToInstall(programData,
												pagesNeeded,
												[],
												0);
		createPagesFromData(programToInstall);

	}
	
	var createPagesFromData = function(_programToInstall){
		for(var i = 0; i < _programToInstall.pagesNeeded; i++){
			
			// Get a page based upon device size and save it in an array of pages.
			var thisPage = _programToInstall.programData.slice(
				connectedDevice.pageSize * i,  
				(connectedDevice.pageSize * i + connectedDevice.pageSize));

			_programToInstall.programDataByPage.push(thisPage);
		}
		addLastPagePadding(_programToInstall);
	}

	var addLastPagePadding = function(_programToInstall){
		var paddingNeeded = connectedDevice.pageSize * _programToInstall.pagesNeeded - 
							_programToInstall.programData.length;
		var lastPageNumber = _programToInstall.pagesNeeded - 1;
		// _programToInstall.programDataByPage[_programToInstall.pagesNeeded].push(Array(pagesNeeded).fill(255));
		var fillArr = Array(paddingNeeded).fill(255);
		console.log(_programToInstall.programDataByPage[lastPageNumber]);
		_programToInstall.programDataByPage[lastPageNumber] = _programToInstall.programDataByPage[lastPageNumber].concat(fillArr);
		console.log(_programToInstall.programDataByPage[lastPageNumber]);
	}
	
	var startUpload = function(){
		writeString("F")
		activeCommand = CommandEnum['waitingForPageRequest'];
	}

	var writePage = function(data){
		if(programToInstall.writtenPageIndex === programToInstall.pagesNeeded){
			writeString("?");
			activeCommand = CommandEnum['waitingOnCompleteWriteConfirmation']
		}
		writeString("!");
		writeData(programToInstall.programDataByPage[programToInstall.writtenPageIndex]);
		programToInstall.writtenPageIndex++;
	}

	var toByteString = function (byte) {
		return ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
	}

	var getDeviceFromSignature = function (signature) {
		for (key in DEVICE_SIGNATURES) {
			if (DEVICE_SIGNATURES[key] === signature) {
				return key;
			}
		}
	}

	var DEVICE_SIGNATURES = Object.freeze({
		ATTINY_13A: 0x1E9007,
		ATTINY_13: 0x1E9007,
		ATTINY_1634: 0x1E9412,
		ATTINY_167: 0x1E9487,
		ATTINY_2313A: 0x1E910A,
		ATTINY_2313: 0x1E910A,
		ATTINY_24A: 0x1E910B,
		ATTINY_24: 0x1E910B,
		ATTINY_25: 0x1E910B,
		ATTINY_261A: 0x1E910C,
		ATTINY_261: 0x1E910C,
		ATTINY_4313: 0x1E920D,
		ATTINY_44A: 0x1E9207,
		ATTINY_44: 0x1E9207,
		ATTINY_441: 0x1E9215,
		ATTINY_45: 0x1E9206,
		ATTINY_461A: 0x1E9208,
		ATTINY_461: 0x1E9208,
		ATTINY_48: 0x1E9209,
		ATTINY_84A: 0x1E930C,
		ATTINY_84: 0x1E930C,
		ATTINY_841: 0x1E9315,
		ATTINY_85: 0x1E930B,
		ATTINY_861A: 0x1E930D,
		ATTINY_861: 0x1E930D,
		ATTINY_87: 0x1E9387,
		ATTINY_88: 0x1E9311,
		ATMEGA_162: 0x1E9403,
		ATMEGA_164A: 0x1E940F,
		ATMEGA_164PA: 0x1E940A,
		ATMEGA_164P: 0x1E940A,
		ATMEGA_165A: 0x1E9410,
		ATMEGA_165PA: 0x1E9407,
		ATMEGA_165P: 0x1E9407,
		ATMEGA_168A: 0x1E9406,
		ATMEGA_168: 0x1E9406,
		ATMEGA_168PA: 0x1E940B,
		ATMEGA_168P: 0x1E940B,
		ATMEGA_169A: 0x1E9411,
		ATMEGA_169PA: 0x1E9405,
		ATMEGA_169P: 0x1E9405,
		ATMEGA_16A: 0x1E9403,
		ATMEGA_16: 0x1E9403,
		ATMEGA_16HVA: 0x1E940C,
		ATMEGA_16HVB: 0x1E940D,
		ATMEGA_16ATMEGA_1: 0x1E9484,
		ATMEGA_16U2: 0x1E9489,
		ATMEGA_16U4: 0x1E9488,
		ATMEGA_324A: 0x1E9515,
		ATMEGA_324PA: 0x1E9511,
		ATMEGA_324P: 0x1E9508,
		ATMEGA_3250A: 0x1E950E,
		ATMEGA_3250: 0x1E9506,
		ATMEGA_3250PA: 0x1E950E,
		ATMEGA_3250P: 0x1E950E,
		ATMEGA_325A: 0x1E9505,
		ATMEGA_325: 0x1E9505,
		ATMEGA_325PA: 0x1E9505,
		ATMEGA_325P: 0x1E950D,
		ATMEGA_328: 0x1E9514,
		ATMEGA_328P: 0x1E950F,
		ATMEGA_3290A: 0x1E950C,
		ATMEGA_3290: 0x1E9504,
		ATMEGA_3290PA: 0x1E950C,
		ATMEGA_3290P: 0x1E950C,
		ATMEGA_329A: 0x1E9503,
		ATMEGA_329: 0x1E9503,
		ATMEGA_329PA: 0x1E950B,
		ATMEGA_329P: 0x1E950B,
		ATMEGA_32A: 0x1E9502,
		ATMEGA_32C1: 0x1E9586,
		ATMEGA_32: 0x1E9502,
		ATMEGA_32HVB: 0x1E9510,
		ATMEGA_32ATMEGA_1: 0x1E9584,
		ATMEGA_32U2: 0x1E958A,
		ATMEGA_32U4: 0x1E9587,
		ATMEGA_406: 0x1E9507,
		ATMEGA_48A: 0x1E9205,
		ATMEGA_48: 0x1E9205,
		ATMEGA_48PA: 0x1E920A,
		ATMEGA_48P: 0x1E920A,
		ATMEGA_640: 0x1E9608,
		ATMEGA_644A: 0x1E9609,
		ATMEGA_644: 0x1E9609,
		ATMEGA_644PA: 0x1E960A,
		ATMEGA_644P: 0x1E960A
	});

	var setOnConnectedToTSB = function (_onConnectedToTSB) {
		onConnectedToTSB = _onConnectedToTSB;
	}

	var readFlash = function () {
		if(!checkIfConnected()){ return false; }
		activeCommand = CommandEnum['readInitiated']
		commandRouting();
	}


	var appendUint8Buffer = function (bufferOne, bufferTwo) {
		var tmp = new Uint8Array(bufferOne.byteLength + bufferTwo.byteLength);
		tmp.set(new Uint8Array(bufferOne), 0);
		tmp.set(new Uint8Array(bufferTwo), bufferOne.byteLength)
		return tmp.buffer;
	}

	var setOnFinishedReading = function (_onFinishedReading) {
		onFinishedReading = _onFinishedReading;
	}

	var getInstalledProgramData = function () {
		return installedProgram.programData;
	}

	var getInstalledProgramNumberOfPages = function () {
		return installedProgram.numberOfPages;
	}

	var getConnectedDevicePageSize = function () {
		if (connectedDevice.pageSize) {
			return connectedDevice.pageSize;
		}
		return false;
	}

	var checkIfConnected = function(){
		if(connectedDevice &&
		   writeString &&
		   writeData){
			return true;
		}
		return false;
	}

	var setResetPin = function(pinNumber){
		resetPin = pinNumber;
	}

	var getResetPinNumber = function(){
		return resetPin;
	}

	return {
		init: init,
		setWriteString: setWriteString,
		setWriteData: setWriteData,
		onReceivedData: onReceivedData,
		setHandshakeButton: setHandshakeButton,
		getControllingSerial: getControllingSerial,
		setDisplayText: setDisplayText,
		setOnConnectedToTSB: setOnConnectedToTSB,
		upload: upload,
		setOnFinishedReading: setOnFinishedReading,
		getInstalledProgramData: getInstalledProgramData,
		getInstalledProgramNumberOfPages: getInstalledProgramNumberOfPages,
		getConnectedDevicePageSize: getConnectedDevicePageSize,
		readInitiated: readInitiated,
		setResetPin: setResetPin,
		getResetPinNumber: getResetPinNumber
	}
})();
