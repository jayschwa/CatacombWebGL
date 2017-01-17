package main

import (
	"flag"
	"image"
	"image/color"
	"image/png"
	"os"
)

type ResizedCanvas struct {
	image.Image
	Width, Height int
}

func (i ResizedCanvas) At(x, y int) color.Color {
	xOffset := (i.Width - i.Image.Bounds().Dx()) / 2
	yOffset := i.Height - i.Image.Bounds().Dy()
	point := image.Pt(x, y).Sub(image.Pt(xOffset, yOffset))
	return i.Image.At(point.X, point.Y)
}

func (i ResizedCanvas) Bounds() image.Rectangle {
	return image.Rectangle{
		Max: image.Point{i.Width, i.Height},
	}
}

type MultiImage []image.Image

func (mi MultiImage) At(x, y int) color.Color {
	for _, i := range mi {
		if x >= i.Bounds().Dx() {
			x -= i.Bounds().Dx()
		} else {
			return i.At(x, y)
		}
	}
	return color.RGBA{0, 0, 0, 0}
}

func (mi MultiImage) Bounds() image.Rectangle {
	var width, height int
	for _, i := range mi {
		width += i.Bounds().Dx()
		if i.Bounds().Dy() > height {
			height = i.Bounds().Dy()
		}
	}
	return image.Rectangle{
		Max: image.Point{width, height},
	}
}

func (mi MultiImage) ColorModel() color.Model {
	return color.RGBAModel
}

func main() {
	w := flag.Int("w", 64, "Fit pictures to this width")
	h := flag.Int("h", 64, "Fit pictures to this height")
	flag.Parse()
	outfilename := flag.Args()[0]
	infilenames := flag.Args()[1:]
	var images MultiImage
	for _, name := range infilenames {
		f, err := os.Open(name)
		if err != nil {
			panic(err)
		}
		img, _, err := image.Decode(f)
		if err != nil {
			panic(err)
		}
		img = ResizedCanvas{img, *w, *h}
		images = append(images, img)
		f.Close()
	}
	f, err := os.Create(outfilename)
	if err != nil {
		panic(err)
	}
	png.Encode(f, images)
	f.Close()
}
