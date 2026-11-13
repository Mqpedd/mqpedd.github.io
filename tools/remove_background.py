#!/usr/bin/env python3
"""Remove the background from photos with a local AI model (rembg), keeping only the main subject.

Use this when the backdrop is a real scene (a desk, a wall, a room). For a plain green backdrop,
tools/prep_images.mjs --key-green is faster and needs no model.

Runs in the project virtual environment:
    .venv/bin/python tools/remove_background.py <input...> [--out .tmp/cutouts] [--model isnet-general-use] [--max 2400]

Fixing the model's mistakes by hand (coordinates are in the output image's pixels, after --max scaling):
    --fill  "x,y x,y x,y ..."   force a polygon fully opaque (fills holes, e.g. in a glass panel)
    --erase "x,y x,y x,y ..."   force a polygon fully transparent (removes leftover background)
Both can be repeated. Edges are anti-aliased.

Output: <out>/<name>.png with a transparent background, ready for tools/prep_images.mjs --fit.
The first run of each model downloads it to ~/.rembg/models/ (170 MB to 1 GB).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps
from rembg import new_session, remove


def polygon_mask(size, polygons, scale=4):
    """White inside the polygons, black outside; drawn large and scaled down for smooth edges."""
    big = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    draw = ImageDraw.Draw(big)
    for poly in polygons:
        points = [tuple(float(v) * scale for v in pair.split(",")) for pair in poly.split()]
        if len(points) < 3:
            raise SystemExit(f"polygon needs at least 3 points: {poly!r}")
        draw.polygon(points, fill=255)
    return big.resize(size, Image.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, default=Path(".tmp/cutouts"))
    parser.add_argument("--model", default="isnet-general-use",
                        help="rembg model: isnet-general-use (default, good edges on objects), u2net, birefnet-general (best, ~1 GB)")
    parser.add_argument("--max", type=int, default=2400, help="longest side before processing; larger is slower, not sharper")
    parser.add_argument("--fill", action="append", default=[], help='polygon to force opaque: "x,y x,y x,y"')
    parser.add_argument("--erase", action="append", default=[], help='polygon to force transparent: "x,y x,y x,y"')
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    session = new_session(args.model)

    for src in args.inputs:
        if not src.exists():
            print(f"missing: {src}", file=sys.stderr)
            return 1
        img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")  # respect phone rotation
        img.thumbnail((args.max, args.max), Image.LANCZOS)
        cut = remove(img, session=session, post_process_mask=True)
        alpha = cut.getchannel("A")
        if args.fill:
            alpha = ImageChops.lighter(alpha, polygon_mask(cut.size, args.fill))
        if args.erase:
            alpha = ImageChops.multiply(alpha, ImageOps.invert(polygon_mask(cut.size, args.erase)))
        cut = img.convert("RGBA")  # original colours (rembg blanks removed pixels, which would show black in filled areas)
        cut.putalpha(alpha)
        kept = sum(alpha.histogram()[128:]) / (cut.width * cut.height)
        dest = args.out / f"{src.stem}.png"
        cut.save(dest)
        print(f"saved {dest} ({cut.width}x{cut.height}, subject covers {kept:.0%} of the frame)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
