"""Cut per-SKU square photos out of the official FURFOO group shots.

The lineup photos hold several products each (nine treats in one 3x3 grid, five
bottles in one scene). The shop grid needs one photo per product, so this script
crops them once into public/media/products/catalog/ -- rerun it after replacing
a source photo, and adjust the centre/size values below to re-frame a product.

    python3 scripts/crop-catalog-photos.py

Requires Pillow (`pip install pillow`).
"""
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parent.parent / 'public' / 'media' / 'products'
OUT = SRC / 'catalog'
SIZE = 620

# name: (source photo, centre-x, centre-y, crop size) in source pixels
CROPS = {
    # all-in-one.jpg is a clean 3x3 grid of 360px cells
    'ostrich-jerky':      ('all-in-one.jpg', 540, 180, 360),
    'nutrichew-donuts':   ('all-in-one.jpg', 900, 180, 360),
    'duck-jerky':         ('all-in-one.jpg', 180, 900, 360),
    'chicken-jerky':      ('all-in-one.jpg', 540, 900, 360),
    'beef-jerky':         ('all-in-one.jpg', 900, 900, 360),

    # shampoo.jpg — five bottles left to right
    'outdoor-shield-spray':  ('shampoo.jpg', 250, 600, 390),
    'aroma-care-shampoo':    ('shampoo.jpg', 480, 555, 540),
    'gentle-ear-wash':       ('shampoo.jpg', 635, 690, 340),
    'fresh-bloom-shampoo':   ('shampoo.jpg', 775, 545, 540),
    'fresh-bloom-spray':     ('shampoo.jpg', 985, 600, 400),

    # herbal-bath-sachets.jpg — five packets
    'bath-zen-calm':     ('herbal-bath-sachets.jpg', 440, 335, 290),
    'bath-itch-relief':  ('herbal-bath-sachets.jpg', 790, 355, 390),
    'bath-bug-shield':   ('herbal-bath-sachets.jpg', 405, 545, 400),
    'bath-calm-skin':    ('herbal-bath-sachets.jpg', 850, 560, 400),
    'bath-shiny-coat':   ('herbal-bath-sachets.jpg', 655, 700, 430),

    # scent-pouch.jpg — two home sachets
    'sachet-zen-calm':     ('scent-pouch.jpg', 460, 640, 620),
    'sachet-itch-relief':  ('scent-pouch.jpg', 895, 590, 620),
}


def crop(name, source, centre_x, centre_y, size):
    image = Image.open(SRC / source)
    width, height = image.size
    left = max(0, min(width - size, centre_x - size / 2))
    top = max(0, min(height - size, centre_y - size / 2))
    box = (round(left), round(top), round(left + size), round(top + size))
    tile = image.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    tile.save(OUT / f'{name}.jpg', quality=88, optimize=True, progressive=True)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for name, arguments in CROPS.items():
        crop(name, *arguments)
        print(f'{name}.jpg')
