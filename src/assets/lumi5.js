//https://developer.mozilla.org/en-US/docs/Web/API/BluetoothRemoteGATTServer
var log = console.log;

//var writeCharacteristic;
var descriptor;
var receivedString = "";
var displayDOM = 'terminal';
var handshakeButton = 'handshake-btn';
var file;
var rawHexArrayBuffer;
var hexArrayBuffer;
var hexString;

let primaryService = document.getElementById('optionalServices').value;

//console.log(navigator.usb.getDevices());
function onScanButtonClick() {
	lumiBle.searchAndConnect(parseInt(primaryService), terminal.addSystemText).
	then(() => {
		lumiBle.addReceivedDataCallback(onReceivedData);
		lumiBle.addReceivedDataCallback(tsb.onReceivedData);
		tsb.setWriteData(lumiBle.writeData);
		tsb.setWriteString(lumiBle.writeString);
		document.getElementById("search-and-connect-btn").classList.remove('tsb-button-file-parse');
		document.getElementById("search-and-connect-btn").classList.add('tsb-button-search-and-connect-complete');
	})
}


function onReceivedData(event) {
	if (!tsb.getControllingSerial()) {
		for (var i = 0; i < event.target.value.byteLength; i++) {
			receivedString += String.fromCharCode(event.target.value.getUint8(i));
		}
		terminal.addTerminalLine(displayDOM, receivedString, '<- ', 'received-text');
		receivedString = "";
	}
}

function onWriteButtonClick() {
	let textToWrite = document.getElementById('textToWrite').value;
	lumiBle.writeString(textToWrite, terminal.addSystemText).then(_ => {
		terminal.addTerminalLine(displayDOM, textToWrite, '-> ', 'sent-text');
	})
}

var fileFinishedLoading = function (event) {
	file = event.target;
	rawHexArrayBuffer = file.result;

	document.getElementById("upload-btn").classList.remove('tsb-btn-hidden');
	document.getElementById("upload-btn").classList.add('tsb-btn-visible');
	hexDataHandler.setData(rawHexArrayBuffer);
}

var onConnectedToTSB = function () {
	document.getElementById("read-btn").classList.remove('tsb-btn-hidden');
	document.getElementById("handshake-btn").classList.remove('tsb-btn-hidden');
	document.getElementById("file-parse-btn").classList.remove('tsb-btn-hidden');
}

var onCompletedParsingFile = function () {
	hexString = hexDataHandler.getAllDataAsString();
	//displayHexFile(50, hexString);
}

//var displayHexFile = async function () {
//	
//	var hexString = hexDataHandler.getAllDataAsString();
//	var numberOfLines = hexString.length / 16;
//	var pos = 0;
//	for (var j = 0; j < numberOfLines; j++) {
//		var thisLine = (j*16).toString(16) + ":  ";
//		for (var i = 0; i < 16; i++) {
//			thisLine += hexString[pos];
//			thisLine += " ";
//			pos++;
//		}
//		await sleep(1);
//		addSystemText(thisLine)
//	}
//}


var displayHexFile = async function (numberOfChunks, data) {

	var numberOfLines = data.length / 16;
	var pos = 0;
	var displayChunkSize = 1;
	//var numberOfChunks = numberOfLines / displayChunkSize;

	for (var j = 0; j < displayChunkSize; j++) {
		var thisLine = "L#: " + pos + " ";
		for (var i = 0; i < 16; i++) {
			thisLine += data[pos];
			thisLine += " ";
			pos++;
		}
		addSystemText(thisLine, false);
		await sleep(5);
	}
}


var onTerminalScroll = function (event) {

	var childs = (event.target.childNodes);

	var terminalHeight = event.target.parentNode.scrollHeight;
	var topIndex = event.target.scrollTop;
	var bottomIndex = topIndex + terminalHeight;
	var bottomMax = event.target.scrollHeight;
	var scrollPaddingAtBottom = 5;
	if (bottomIndex >= bottomMax - scrollPaddingAtBottom) {

		//displayHexFile(40);
		//console.log("Bottom");
	}

	// console.log(bottomMax + ":" + bottomIndex + ":" + topIndex);

}

var finishedReadingFlashFromDevice = function () {
	var data = tsb.getInstalledProgramData();
	var numberOfLines = tsb.getInstalledProgramNumberOfPages() * (tsb.getInstalledProgramNumberOfPages() * (tsb.getConnectedDevicePageSize() / 16));
	var dataAsString = hexDataHandler.formatUint8AsString(data);
	displayHexFile(numberOfLines, dataAsString);
	document.getElementById("read-btn").classList.add('tsb-button-read-complete');
}

var sleep = function (ms) {
	return new Promise(resolve => setTimeout(resolve));
}

var upload = function () {
	tsb.upload(hexDataHandler.getAllData());
}

var readFlash = function () {
	addSystemText("Reading flash...")
	tsb.readInitiated();
}

function changeResetPin() {
	let resetPinNumber = document.getElementById('resetPinNumber').value;
	tsb.setResetPin(parseInt(resetPinNumber));
	document.getElementById('resetPinNumber').value = tsb.getResetPinNumber();
}

// Setup the display terminal
var terminal = Terminal;
terminal.setDisplayDOM(displayDOM);

// Setup Web API BLE device
var lumiBle = LumiBluetooth;

// Prepare the uploader
var tsb = TinySafeBoot;
tsb.setHandshakeButton(handshakeButton);
tsb.setDisplayText(terminal.addSystemText);
tsb.setOnConnectedToTSB(onConnectedToTSB);
tsb.setOnFinishedReading(finishedReadingFlashFromDevice);

// Get the file handler set.
var fileHandler = FileHandler;
fileHandler.setDisplayMethod(terminal.addSystemText);
fileHandler.setOnFinishedLoadingFile(fileFinishedLoading)

var hexDataHandler = HexDataHandler;
hexDataHandler.setAddTextToDisplayMethod(terminal.addSystemText);
hexDataHandler.setOnCompletedParsingFile(onCompletedParsingFile);

document.getElementById('search-btn').onclick = onScanButtonClick;
document.getElementById('btn-write-ble').onclick = onWriteButtonClick;
document.getElementById('upload-file').addEventListener('change', fileHandler.loadFile, false);
document.getElementById('file-parse-btn').onclick = function(){
	 document.getElementById('upload-file').click();
}
document.getElementById(handshakeButton).addEventListener('change', null, false);
document.getElementById('terminal').addEventListener('scroll', onTerminalScroll, false);
document.getElementById('read-btn').onclick = readFlash;
document.getElementById('upload-btn').onclick = upload;
document.getElementById('set-reset-pin-btn').onclick = changeResetPin;