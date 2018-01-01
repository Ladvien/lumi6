import { Component } from '@angular/core';
import { enableProdMode } from '@angular/core';
// import * as variable from 'FileHandler';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = "I'm trying";
  fileHandler = FileHandler;
  ble = LumiBluetooth;

  displayText = '';

  search () {
    this.ble.searchAndConnect(this.addSystemText);
  }

  addSystemText (text) {
    console.log(text);
  }

  fileProvided (event) {
    FileHandler.loadFile(event);
  }

}
