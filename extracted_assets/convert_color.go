package main

import (
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

type ColorTweakedImage struct {
	image.Image
	Find, Replace color.Color
	Changed       *bool
}

func (i ColorTweakedImage) At(x, y int) color.Color {
	c := i.Image.At(x, y)
	if equalColors(c, i.Find) {
		*i.Changed = true
		return i.Replace
	} else {
		return c
	}
}

func equalColors(c1, c2 color.Color) bool {
	r1, g1, b1, _ := c1.RGBA()
	r2, g2, b2, _ := c2.RGBA()
	return r1 == r2 && g1 == g2 && b1 == b2
}

func transform(filename string, find, replace color.Color) bool {
	f, err := os.Open(filename)
	if err != nil {
		panic(err)
	}
	img, _, err := image.Decode(f)
	if err != nil {
		panic(err)
	}
	f.Close()
	ctimg := ColorTweakedImage{img, find, replace, new(bool)}
	f, err = os.Create(filename)
	if err != nil {
		panic(err)
	}
	png.Encode(f, ctimg)
	f.Close()
	return *ctimg.Changed
}

func main() {
	flag.Parse()
	filenames := flag.Args()
	find := color.RGBA{0xAA, 0xAA, 0x00, 0xFF}
	replace := color.RGBA{0xAA, 0x55, 0x00, 0xFF}
	totalChanged := 0
	for _, name := range filenames {
		changed := transform(name, find, replace)
		if changed {
			totalChanged += 1
		}
	}
	fmt.Println(totalChanged)
}
