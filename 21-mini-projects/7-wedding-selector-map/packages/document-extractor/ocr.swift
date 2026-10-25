import Foundation
import Vision
import AppKit

// One JSON result per image. Bounding boxes use Vision's bottom-left origin.
let paths = Array(CommandLine.arguments.dropFirst())
for path in paths {
  do {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    let handler = VNImageRequestHandler(url: URL(fileURLWithPath: path))
    try handler.perform([request])
    let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      let b = observation.boundingBox
      return ["text": candidate.string, "confidence": candidate.confidence,
              "x": b.origin.x, "y": b.origin.y, "width": b.width, "height": b.height]
    }
    let data = try JSONSerialization.data(withJSONObject: ["path": path, "lines": lines], options: [.sortedKeys])
    print(String(data: data, encoding: .utf8)!)
  } catch {
    let data = try! JSONSerialization.data(withJSONObject: ["path": path, "error": String(describing: error)])
    print(String(data: data, encoding: .utf8)!)
  }
}
