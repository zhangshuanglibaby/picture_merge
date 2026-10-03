"""Generate small, deterministic PNG fixtures without third-party packages.

Run from any directory with: python3 server/test/fixtures/generate.py
The images are synthetic; no personal screenshots or private data are used.
"""

from pathlib import Path
import binascii
import struct
import zlib


OUTPUT_DIR = Path(__file__).resolve().parent
STANDARD_WIDTH = 240


def png_chunk(kind: bytes, data: bytes) -> bytes:
    """A PNG chunk contains its length, type, data, and a CRC checksum."""
    checksum = binascii.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def scene_row(width: int, y: int) -> bytes:
    """Draw a screenshot-like row; absolute y keeps overlapping slices identical."""
    result = bytearray()
    section = y // 72
    local_y = y % 72
    for x in range(width):
        if local_y < 6:
            rgb = (34, 67, 82)  # Thin separator between content sections.
        elif 18 <= local_y < 23 and 14 <= x < width - 24:
            rgb = (61 + section * 17 % 130, 105, 120)
        elif 29 <= local_y < 33 and 14 <= x < width - 55:
            rgb = (110, 130 + section * 7 % 90, 138)
        elif 42 <= local_y < 58 and width - 49 <= x < width - 15:
            rgb = (80 + section * 13 % 120, 170, 157)
        else:
            rgb = (246, 249, 248)
        result.extend(rgb)
    return bytes(result)


def save_png(name: str, rows: list[bytes], width: int, channels: int = 3) -> None:
    """Write RGB/RGBA rows as a complete PNG with no external image library."""
    assert rows and all(len(row) == width * channels for row in rows)
    color_type = 2 if channels == 3 else 6
    header = struct.pack(">IIBBBBB", width, len(rows), 8, color_type, 0, 0, 0)
    # PNG filter byte 0 means every row stores its pixels without a filter.
    pixels = b"".join(b"\x00" + row for row in rows)
    image = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(pixels))
        + png_chunk(b"IEND", b"")
    )
    (OUTPUT_DIR / name).write_bytes(image)


def slice_image(name: str, start: int, end: int, width: int = STANDARD_WIDTH) -> None:
    """A slice of the same scene represents one screenshot in a series."""
    save_png(name, [scene_row(width, y) for y in range(start, end)], width)


def generate() -> None:
    # Exact 100-pixel overlap: second image begins at row 220 of the scene.
    slice_image("overlap-1.png", 0, 320)
    slice_image("overlap-2.png", 220, 540)

    # Two adjacent, non-overlapping slices must both remain intact.
    slice_image("plain-1.png", 0, 320)
    slice_image("plain-2.png", 320, 640)

    # Five images: crop 80, 0, 70, and 0 pixels from images 2 through 5.
    for index, (start, end) in enumerate(
        [(0, 300), (220, 520), (520, 820), (750, 1050), (1050, 1350)],
        start=1,
    ):
        slice_image(f"mixed-{index}.png", start, end)

    # Only a short header-like strip matches; the body is different.
    first = [scene_row(STANDARD_WIDTH, y) for y in range(0, 300)]
    second = first[-40:] + [scene_row(STANDARD_WIDTH, y) for y in range(700, 960)]
    save_png("header-1.png", first, STANDARD_WIDTH)
    save_png("header-2.png", second, STANDARD_WIDTH)

    # The wider first image should shrink to the width of the second image.
    slice_image("width-1.png", 0, 300, width=320)
    slice_image("width-2.png", 300, 600)

    # Fully transparent pixels must become white after the future normalization step.
    transparent_rows = []
    for y in range(100):
        rgb = scene_row(STANDARD_WIDTH, 600 + y)
        transparent_rows.append(
            b"".join(
                rgb[x : x + 3] + (b"\x00" if x >= 120 else b"\xff")
                for x in range(0, len(rgb), 3)
            )
        )
    save_png("transparent.png", transparent_rows, STANDARD_WIDTH, channels=4)

    # It has a PNG extension but cannot be decoded as a PNG image.
    (OUTPUT_DIR / "invalid.png").write_bytes(b"not a valid PNG image")


if __name__ == "__main__":
    generate()
