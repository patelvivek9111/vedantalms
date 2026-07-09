"""
Generate centered favicon assets for Google search and Edge browser support.
Does not modify any website UI — only public icon files and index.html head links.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend" / "public" / "assets"
PUBLIC = ROOT / "frontend" / "public"
SOURCE = ASSETS / "vedanta_favicon2.png"

# Extra padding around the logo (fraction of final square) for circular crops (Google).
SAFE_PADDING_RATIO = 0.14

OUTPUTS = [
    (PUBLIC / "favicon.ico", [16, 32, 48]),
    (ASSETS / "favicon-16x16.png", [16]),
    (ASSETS / "favicon-32x32.png", [32]),
    (ASSETS / "favicon-48x48.png", [48]),
    (ASSETS / "favicon-192x192.png", [192]),
    (ASSETS / "apple-touch-icon.png", [180]),
    # Keep existing filenames in sync (centered versions).
    (ASSETS / "vedanta_favicon2.png", [512]),
    (ASSETS / "vedanta_favicon.png", [180]),
]


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of visible (non-black) pixels."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and (r + g + b) > 40:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < minx:
        return 0, 0, w - 1, h - 1
    return minx, miny, maxx, maxy


def build_master_square(source: Path) -> Image.Image:
    img = Image.open(source).convert("RGBA")
    minx, miny, maxx, maxy = content_bbox(img)
    cropped = img.crop((minx, miny, maxx + 1, maxy + 1))

    cw, ch = cropped.size
    side = max(cw, ch)
    # Transparent square with logo perfectly centered.
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square.paste(cropped, (ox, oy), cropped)

    pad = int(side * SAFE_PADDING_RATIO)
    final_side = side + pad * 2
    final = Image.new("RGBA", (final_side, final_side), (0, 0, 0, 0))
    final.paste(square, (pad, pad), square)
    return final


def resize_icon(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def save_ico(path: Path, sizes: list[int], master: Image.Image) -> None:
    images = [resize_icon(master, s) for s in sizes]
    base = images[-1]
    base.save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source not found: {SOURCE}")

    master = build_master_square(SOURCE)
    master_side = master.size[0]
    print(f"Master square: {master_side}x{master_side}px (centered + {SAFE_PADDING_RATIO:.0%} safe padding)")

    ico_sizes: list[int] | None = None
    for path, sizes in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix.lower() == ".ico":
            ico_sizes = sizes
            save_ico(path, sizes, master)
            print(f"Wrote {path} ({', '.join(f'{s}x{s}' for s in sizes)})")
        else:
            size = sizes[0]
            out = resize_icon(master, size)
            out.save(path, format="PNG", optimize=True)
            print(f"Wrote {path} ({size}x{size})")

    print("Done.")


if __name__ == "__main__":
    main()
