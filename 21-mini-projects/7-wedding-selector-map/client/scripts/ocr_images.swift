import Foundation
import Vision

let root = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
let extensions = Set(["png", "jpg", "jpeg"])
let files = (FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)!.allObjects as! [URL])
    .filter { extensions.contains($0.pathExtension.lowercased()) && $0.path.contains(".assets/") }
    .sorted { $0.path < $1.path }
var output: [String: [[String: Any]]] = [:]
for (index, file) in files.enumerated() {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(url: file, options: [:]).perform([request])
        let lines = (request.results ?? []).compactMap { result -> [String: Any]? in
            guard let text = result.topCandidates(1).first else { return nil }
            return ["text": text.string, "confidence": text.confidence,
                    "x": result.boundingBox.origin.x, "y": result.boundingBox.origin.y,
                    "width": result.boundingBox.width, "height": result.boundingBox.height]
        }
        output[String(file.path.dropFirst(root.path.count + 1))] = lines
    } catch {
        output[String(file.path.dropFirst(root.path.count + 1))] = [["error": error.localizedDescription]]
    }
    if (index + 1) % 10 == 0 { print("OCR \(index + 1)/\(files.count)"); fflush(stdout) }
}
let data = try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys])
try data.write(to: destination)
print("OCR complete: \(files.count) images")
