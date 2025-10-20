import Foundation
import Cocoa

func sendEventToElectron(keyCode: Int, flags: Int, type: String) {
    let eventData: [String: Any] = [
        "type": type,
        "keyCode": keyCode,
        "flags": flags,
        "timestamp": Date().timeIntervalSince1970 * 1000
    ]
    if let jsonData = try? JSONSerialization.data(withJSONObject: eventData, options: []) {
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print("WAVE_EVENT:\(jsonString)")
            fflush(stdout)
        }
    }
}

let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)

let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: CGEventMask(eventMask),
    callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags
        let keyCodeInt = Int(keyCode)
        let flagsInt = Int(flags.rawValue)
        let eventType: String
        switch type {
        case .keyDown:
            eventType = "keyDown"
        case .keyUp:
            eventType = "keyUp"
        case .flagsChanged:
            eventType = "flagsChanged"
        default:
            eventType = "unknown"
        }
        sendEventToElectron(keyCode: keyCodeInt, flags: flagsInt, type: eventType)
        return Unmanaged.passUnretained(event)
    },
    userInfo: nil
)

if let eventTap = eventTap {
    let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
    CGEvent.tapEnable(tap: eventTap, enable: true)
    // Send ready signal to Electron
    let readyData: [String: Any] = [
        "type": "keyboard_listener_ready",
        "keyCode": 0,
        "flags": 0,
        "timestamp": Date().timeIntervalSince1970 * 1000
    ]
    if let jsonData = try? JSONSerialization.data(withJSONObject: readyData, options: []) {
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print("WAVE_EVENT:\(jsonString)")
            fflush(stdout)
        }
    }
    CFRunLoopRun()
} else {
    print("WAVE_ERROR:Failed to create event tap. Accessibility permissions required.")
    exit(1)
}