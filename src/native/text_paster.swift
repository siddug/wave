import Foundation
import AppKit

class TextPaster {
    private static let pasteCompletionDelay: TimeInterval = 0.3
    
    static func pasteAtCursor(_ text: String, shouldPreserveClipboard: Bool = true) {
        let pasteboard = NSPasteboard.general
        
        var savedContents: [(NSPasteboard.PasteboardType, Data)] = []
        
        if shouldPreserveClipboard {
            let currentItems = pasteboard.pasteboardItems ?? []
            
            for item in currentItems {
                for type in item.types {
                    if let data = item.data(forType: type) {
                        savedContents.append((type, data))
                    }
                }
            }
        }
        
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        
        // Try CGEvent method first, fallback to AppleScript if needed
        if !pasteUsingCommandV() {
            _ = pasteUsingAppleScript()
        }
        
        if shouldPreserveClipboard && !savedContents.isEmpty {
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + pasteCompletionDelay) {
                pasteboard.clearContents()
                for (type, data) in savedContents {
                    pasteboard.setData(data, forType: type)
                }
            }
        }
        
        // Send completion event to Electron
        sendEventToElectron(eventType: "text_pasted", text: text)
    }
    
    private static func pasteUsingCommandV() -> Bool {
        guard AXIsProcessTrusted() else {
            return false
        }
        
        let source = CGEventSource(stateID: .hidSystemState)
        
        let cmdDown = CGEvent(keyboardEventSource: source, virtualKey: 0x37, keyDown: true)
        let vDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true)
        let vUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
        let cmdUp = CGEvent(keyboardEventSource: source, virtualKey: 0x37, keyDown: false)
        
        cmdDown?.flags = .maskCommand
        vDown?.flags = .maskCommand
        vUp?.flags = .maskCommand
        
        cmdDown?.post(tap: .cghidEventTap)
        vDown?.post(tap: .cghidEventTap)
        vUp?.post(tap: .cghidEventTap)
        cmdUp?.post(tap: .cghidEventTap)
        
        return true
    }
    
    private static func pasteUsingAppleScript() -> Bool {
        guard AXIsProcessTrusted() else {
            return false
        }
        
        let script = """
        tell application "System Events"
            keystroke "v" using command down
        end tell
        """
        
        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            _ = scriptObject.executeAndReturnError(&error)
            return error == nil
        }
        return false
    }
    
    private static func sendEventToElectron(eventType: String, text: String) {
        let eventData: [String: Any] = [
            "type": eventType,
            "text": text,
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: eventData, options: []) {
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                print("WAVE_EVENT:\(jsonString)")
                fflush(stdout)
            }
        }
    }
}

// Command line interface for the text paster
if CommandLine.arguments.count > 1 {
    let text = CommandLine.arguments[1]
    TextPaster.pasteAtCursor(text, shouldPreserveClipboard: true)
}