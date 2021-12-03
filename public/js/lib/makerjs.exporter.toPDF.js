/*
 *  Custom overloading/mixin of the makerjs.exporter.toPDF function.
 */

var MakerJs = require('makerjs');

(function (MakerJs) {
    var exporter;
    (function (exporter) {
        /**
         * Injects drawing into a PDFKit document.
         *
         * @param doc PDFKit.PDFDocument object. See https://pdfkit.org/
         * @param modelToExport Model object to export.
         * @param options Export options object.
         * @returns String of PDF file contents.
         */
        function toPDF(doc, modelToExport, options) {
            if (!modelToExport)
                return;
            //fixup options
            var opts = {
                fontName: 'Courier',
                fontSize: 9,
                origin: [0, 0],
                stroke: "#000"
            };
            MakerJs.extendObject(opts, options);
            //try to get the unit system from the itemToExport
            var scale = 1;
            var exportUnits = opts.units || modelToExport.units;
            if (exportUnits) {
                //convert to inch
                scale = MakerJs.units.conversionScale(exportUnits, MakerJs.unitType.Inch);
            }
            else {
                //assume pixels, convert to inch
                scale = 1 / 100;
            }
            //from inch to PDF PPI
            scale *= 72;
            //TODO scale each element without a whole clone
            var scaledModel = MakerJs.model.scale(MakerJs.cloneObject(modelToExport), scale);
            var size = MakerJs.measure.modelExtents(scaledModel);
            var left = -size.low[0];
            var offset = [left, size.high[1]];
            offset = MakerJs.point.add(offset, options.origin);
            MakerJs.model.findChains(scaledModel, function (chains, loose, layer) {
                function single(walkedPath) {
                    var pathData = exporter.pathToSVGPathData(walkedPath.pathContext, walkedPath.offset, offset);
                    if (walkedPath.layer === "in-case-shape") {
                      doc.path(pathData).fillColor("#F00", 0.2).fill();
                    } else {
                      doc.path(pathData).stroke(opts.stroke);
                    }
                }
                chains.map(function (chain) {
                    if (chain.links.length > 1) {
                        var pathData = exporter.chainToSVGPathData(chain, offset);
                        if (chain.links[0].walkedPath.layer === "in-case-shape") {
                          doc.path(pathData).fillColor("#F00", 0.2).fill();
                        } else {
                          doc.path(pathData).stroke(opts.stroke);
                        }
                    }
                    else {
                        var walkedPath = chain.links[0].walkedPath;
                        if (walkedPath.pathContext.type === MakerJs.pathType.Circle) {
                            var fixedPath;
                            MakerJs.path.moveTemporary([walkedPath.pathContext], [walkedPath.offset], function () {
                                fixedPath = MakerJs.path.mirror(walkedPath.pathContext, false, true);
                            });
                            MakerJs.path.moveRelative(fixedPath, offset);
                            //TODO use only chainToSVGPathData instead of circle, so that we can use fill
                            doc.circle(fixedPath.origin[0], fixedPath.origin[1], walkedPath.pathContext.radius).stroke(opts.stroke);
                        }
                        else {
                            single(walkedPath);
                        }
                    }
                });
                loose.map(single);
            }, { byLayers: true });
            doc.font(opts.fontName).fontSize(opts.fontSize);
            MakerJs.model.getAllCaptionsOffset(scaledModel).forEach(function (caption) {
                //measure the angle of the line, prior to mirroring
                var a = MakerJs.angle.ofLineInDegrees(caption.anchor);
                //mirror into pdf y coords
                var anchor = MakerJs.path.mirror(caption.anchor, false, true);
                //move mirrored line by document offset
                MakerJs.path.moveRelative(anchor, offset);
                //measure center point of text
                var text = caption.text;
                var textCenter = [doc.widthOfString(text) / 2, doc.heightOfString(text) / 2];
                //get center point on line
                var center = MakerJs.point.middle(anchor);
                var textOffset = MakerJs.point.subtract(center, textCenter);
                doc.rotate(-a, { origin: center });
                doc.text(text, textOffset[0], textOffset[1]);
                doc.rotate(a, { origin: center });
            });
        }
        exporter.toPDF = toPDF;
    })(exporter = MakerJs.exporter || (MakerJs.exporter = {}));
})(MakerJs || {});
