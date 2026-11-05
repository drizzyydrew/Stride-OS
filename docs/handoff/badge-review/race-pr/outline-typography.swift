import Foundation
import CoreText
import CoreGraphics

// The same CoreText CTLine/CTFont tooling contract used by the existing legacy
// badge outlining worker. Only new labels are outlined; Firsts stays unchanged.
let input = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [[String: Any]]
var output = [[String: Any]]()
func number(_ value: CGFloat) -> String {
  String(format: "%.8f", Double(value)).replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression)
}
for item in input {
  let text = item["text"] as! String
  let size = item["size"] as! Double
  let baseline = item["baseline"] as! Double
  let tracking = item["tracking"] as! Double
  let maximumWidth = item["maximumWidth"] as! Double
  let font = CTFontCreateWithName("ArialNarrow" as CFString, size, nil)
  precondition(CTFontCopyPostScriptName(font) as String == "ArialNarrow")
  let attributed = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String):font])
  let line = CTLineCreateWithAttributedString(attributed)
  let outline = CGMutablePath()
  var characterIndex = 0
  for run in CTLineGetGlyphRuns(line) as! [CTRun] {
    let count = CTRunGetGlyphCount(run)
    var glyphs = [CGGlyph](repeating:0,count:count)
    var positions = [CGPoint](repeating:.zero,count:count)
    CTRunGetGlyphs(run, CFRange(location:0,length:count), &glyphs)
    CTRunGetPositions(run, CFRange(location:0,length:count), &positions)
    let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
    precondition(CTFontCopyPostScriptName(runFont) as String == "ArialNarrow", "Unexpected fallback font")
    for index in glyphs.indices {
      precondition(glyphs[index] != 0, "Missing glyph")
      if let path = CTFontCreatePathForGlyph(runFont,glyphs[index],nil) {
        let transform = CGAffineTransform(a:1,b:0,c:0,d:-1,tx:positions[index].x + Double(characterIndex)*tracking,ty:baseline - positions[index].y)
        outline.addPath(path, transform:transform)
      }
      characterIndex += 1
    }
  }
  let ink = outline.boundingBoxOfPath
  let fit = min(1,maximumWidth / ink.width)
  var transform = CGAffineTransform(a:fit,b:0,c:0,d:1,tx:50-ink.midX*fit,ty:0)
  let final = outline.copy(using:&transform)!
  let bounds = final.boundingBoxOfPath
  var commands = [String]()
  final.applyWithBlock { pointer in
    let element = pointer.pointee
    let count: Int
    let command: String
    switch element.type {
      case .moveToPoint: command="M";count=1
      case .addLineToPoint: command="L";count=1
      case .addQuadCurveToPoint: command="Q";count=2
      case .addCurveToPoint: command="C";count=3
      case .closeSubpath: command="Z";count=0
      @unknown default: fatalError("Unexpected path element")
    }
    commands.append(command+(0..<count).flatMap { point in [number(element.points[point].x),number(element.points[point].y)] }.joined(separator:" "))
  }
  output.append(["key":item["key"]!,"text":text,"path":commands.joined(),"font":"ArialNarrow","size":size,"baseline":baseline,"tracking":tracking,"horizontalFit":fit,"bounds":[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY]])
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:output,options:[.sortedKeys]))
