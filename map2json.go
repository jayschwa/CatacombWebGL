package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
)

type C3DMap struct {
	Width, Height uint
	Layout        []byte
	Entities      []byte
}

func (m C3DMap) Area() uint {
	return m.Width * m.Height
}

func ReadC3DMap(filename string) C3DMap {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		panic(err)
	}
	m := C3DMap{
		Width:  uint(data[0]),
		Height: uint(data[1]),
	}
	idx := m.Area() + 2
	m.Layout = data[2:idx]
	m.Entities = data[idx:]
	if len(m.Entities) != int(m.Area()) {
		panic("c3dmap size mismatch")
	}
	return m
}

func ReadDescriptions(filename string) (descriptions []string) {
	file, err := os.Open(filename)
	if err != nil {
		panic(err)
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		descriptions = append(descriptions, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
	return
}

type LayoutDef struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

func Wall(name string) LayoutDef {
	return LayoutDef{"wall", name}
}

func Exploding(name string) LayoutDef {
	return LayoutDef{"exploding_wall", name}
}

func Door(color string) LayoutDef {
	return LayoutDef{"door", color}
}

func Description(desc string) LayoutDef {
	return LayoutDef{"description", desc}
}

type JsonMap struct {
	Name   string               `json:"name"`
	Width  uint                 `json:"width"`
	Height uint                 `json:"height"`
	Layout []string             `json:"layout"`
	Legend map[string]LayoutDef `json:"legend"`
}

var ByteToDef = map[byte]LayoutDef{
	0x01: Wall("stone"),
	0x02: Wall("slime"),
	0x03: Wall("white"),
	0x04: Wall("blood"),
	0x05: Wall("tar"),
	0x06: Wall("gold"),
	0x07: Wall("hell"),

	0x08: Exploding("stone"),
	0x09: Exploding("slime"),
	0x0A: Exploding("white"),
	0x0B: Exploding("slime"),
	0x0C: Exploding("tar"),
	0x0D: Exploding("gold"),
	0x0E: Exploding("hell"),

	0x14: Door("red"),
	0x18: Door("yellow"),
	0x1C: Door("green"),
	0x20: Door("blue"),
}

func main() {
	flag.Parse()
	c3dmap := ReadC3DMap(flag.Arg(0))
	descriptions := ReadDescriptions(flag.Arg(1))
	for i, desc := range descriptions {
		ByteToDef[byte(0xB4+i)] = Description(desc)
	}
	nextRune := 'A'
	byteToLetter := make(map[byte]string)
	letterToDef := make(map[string]LayoutDef)

	m := JsonMap{
		Width:  c3dmap.Width,
		Height: c3dmap.Height,
		Layout: make([]string, c3dmap.Height),
	}
	for h := 0; h < int(m.Height); h++ {
		for w := 0; w < int(m.Width); w++ {
			idx := w + h*int(m.Width)
			b := c3dmap.Layout[idx]
			if s, ok := byteToLetter[b]; ok {
				m.Layout[h] += s
			} else {
				s := string(nextRune)
				m.Layout[h] += s
				byteToLetter[b] = s
				letterToDef[s] = ByteToDef[b]
				if nextRune == 'Z' {
					nextRune = 'a'
				} else {
					nextRune += 1
				}
			}
		}
	}
	m.Legend = letterToDef

	out, err := json.MarshalIndent(m, "", "\t")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
}
