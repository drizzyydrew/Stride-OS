import Foundation
import CoreText
import CoreGraphics

let input = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [[String: Any]]
var output = [[String: Any]]()
func number(_ value: CGFloat) -> String {
    String(format: "%.8f", Double(value)).replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression)
}
for item in input {
    let attributes = item["attributes"] as! [String: String]
    let text = item["text"] as! String
    let size = Double(attributes["font-size"]!)!
    let tracking = Double(attributes["letter-spacing"] ?? "0")!
    let font = CTFontCreateWithName("AvenirNext-Heavy" as CFString, size, nil)
    precondition(CTFontCopyPostScriptName(font) as String == "AvenirNext-Heavy")
    let attributed = NSAttributedString(string: text, attributes: [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
    ])
    let line = CTLineCreateWithAttributedString(attributed)
    let width = CTLineGetTypographicBounds(line, nil, nil, nil) + Double(text.count - 1) * tracking
    let x = Double(attributes["x"]!)! - width / 2
    let baseline = Double(attributes["y"]!)!
    var commands = [String]()
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let count = CTRunGetGlyphCount(run)
        var glyphs = [CGGlyph](repeating: 0, count: count)
        var positions = [CGPoint](repeating: .zero, count: count)
        CTRunGetGlyphs(run, CFRange(location: 0, length: count), &glyphs)
        CTRunGetPositions(run, CFRange(location: 0, length: count), &positions)
        let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
        precondition(CTFontCopyPostScriptName(runFont) as String == "AvenirNext-Heavy")
        for index in glyphs.indices {
            guard let path = CTFontCreatePathForGlyph(runFont, glyphs[index], nil) else { continue }
            path.applyWithBlock { pointer in
                let element = pointer.pointee
                let count: Int
                let command: String
                switch element.type {
                case .moveToPoint: command = "M"; count = 1
                case .addLineToPoint: command = "L"; count = 1
                case .addQuadCurveToPoint: command = "Q"; count = 2
                case .addCurveToPoint: command = "C"; count = 3
                case .closeSubpath: command = "Z"; count = 0
                @unknown default: fatalError("Unexpected path element")
                }
                let values = (0..<count).flatMap { point -> [String] in
                    let p = element.points[point]
                    return [number(x + positions[index].x + Double(index) * tracking + p.x), number(baseline - positions[index].y - p.y)]
                }
                commands.append(command + values.joined(separator: " "))
            }
        }
    }
    output.append(["key": item["key"]!, "text": text, "d": commands.joined(), "font": CTFontCopyPostScriptName(font), "advance": width])
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]))
