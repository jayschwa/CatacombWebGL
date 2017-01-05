package main

import (
	"image"
	"image/color"
	"image/png"
	"os"
)

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
	outfilename := os.Args[1]
	infilenames := os.Args[2:]
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
