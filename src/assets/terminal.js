// Terminal JavaScript.
// A webbased terminal emulator
var Terminal = (function (displayDOM) {

    var self = this;
    var displayDOM = displayDOM;
    var terminalLineCounter = 0;

    this.addTerminalLine = function (displayElement, text, pretext, lineStyle, scrollToBottom = true) {

        // 1. Get the element to display text on.
        // 2. Create a div for the new line.
        // 3. Concactenate pre-text and text.
        // 4. Check for style, apply
        // 5. Append the new line DIV to target element.
        // 6. Increment line count.

        if (text && displayElement) {
            var terminal = document.getElementById(displayElement);
            var newLine = document.createElement('div');
            newLine.innerHTML = pretext + text;
            if (lineStyle !== "") {
                newLine.classList.add(lineStyle);
            }
            terminal.appendChild(newLine);
			if(scrollToBottom){
				terminal.scrollTop = terminal.scrollHeight;	
			}
            terminalLineCounter++;
        }
    };

    this.addSystemText = function (text, scrollToBottom = true, _displayDOM = this.displayDOM,) {
        if (text && _displayDOM)
        {
            self.addTerminalLine(_displayDOM, text, '-) ', 'system-text', scrollToBottom);
        }
    }

    this.setDisplayDOM = function (_displayDOM) {
        this.displayDOM = _displayDOM;
    }

    return {
        addTerminalLine: addTerminalLine,
        addSystemText: addSystemText,
        setDisplayDOM: setDisplayDOM
    }
})();
