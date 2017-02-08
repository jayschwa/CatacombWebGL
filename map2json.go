package main

// TODO: omit unreachable tiles?

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type C3DMap struct {
	Width, Height uint
	Layout        []byte
	Entities      []byte
}

func (m C3DMap) Area() uint {
	return m.Width * m.Height
}

func (m C3DMap) Adjacent(index int) (indices []int) {
	for _, i := range []int{index - 1, index + 1, index - int(m.Width), index + int(m.Width)} {
		if i >= 0 && i < int(m.Area()) {
			indices = append(indices, i)
		}
	}
	return
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
	Title       string               `json:"title"`
	LevelNumber int                  `json:"levelNumber"`
	Width       uint                 `json:"width"`
	Height      uint                 `json:"height"`
	Layout      []string             `json:"layout"`
	Legend      map[string]LayoutDef `json:"legend"`
	Entities    []Entity             `json:"entities"`
	Fog         *Fog                 `json:"fog"`
}

var LayoutDict = map[byte]LayoutDef{
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

type Vec2 [2]int

type Entity struct {
	Type          string      `json:"type"`
	Position      Vec2        `json:"position"`
	Direction     *Vec2       `json:"direction,omitempty"`
	Value         interface{} `json:"value,omitempty"`
	MinDifficulty int         `json:"minDifficulty,omitempty"`
}

var EntityDict = map[byte]Entity{
	0x01: Entity{Type: "PlayerStart", Direction: &Vec2{0, -1}}, // North
	0x02: Entity{Type: "PlayerStart", Direction: &Vec2{1, 0}},  // East
	0x03: Entity{Type: "PlayerStart", Direction: &Vec2{0, 1}},  // South
	0x04: Entity{Type: "PlayerStart", Direction: &Vec2{-1, 0}}, // West
	0x05: Entity{Type: "Bolt"},
	0x06: Entity{Type: "Nuke"},
	0x07: Entity{Type: "Potion"},
	0x08: Entity{Type: "RedKey"},
	0x09: Entity{Type: "YellowKey"},
	0x0A: Entity{Type: "GreenKey"},
	0x0B: Entity{Type: "BlueKey"},
	0x0C: Entity{Type: "Scroll", Value: 1},
	0x0D: Entity{Type: "Scroll", Value: 2},
	0x0E: Entity{Type: "Scroll", Value: 3},
	0x0F: Entity{Type: "Scroll", Value: 4},
	0x10: Entity{Type: "Scroll", Value: 5},
	0x11: Entity{Type: "Scroll", Value: 6},
	0x12: Entity{Type: "Scroll", Value: 7},
	0x13: Entity{Type: "Scroll", Value: 8},
	0x14: Entity{Type: "Grelminar"},
	0x15: Entity{Type: "Treasure"},

	0x16: Entity{Type: "Troll"},
	0x17: Entity{Type: "Orc"},
	0x18: Entity{Type: "WarpGate"},
	0x19: Entity{Type: "Bat"},
	0x1A: Entity{Type: "Demon"},
	0x1B: Entity{Type: "Mage"},
	0x1C: Entity{Type: "Nemesis"},
	0x1D: Entity{Type: "Fireball", Direction: &Vec2{0, 1}}, // North-South
	0x1E: Entity{Type: "Fireball", Direction: &Vec2{1, 0}}, // East-West

	0x1F: Entity{Type: "Teleport", Value: 1},
	0x20: Entity{Type: "Teleport", Value: 2},
	0x21: Entity{Type: "Teleport", Value: 3},

	0x24: Entity{Type: "Troll", MinDifficulty: 1},
	0x25: Entity{Type: "Orc", MinDifficulty: 1},
	0x26: Entity{Type: "Bat", MinDifficulty: 1},
	0x27: Entity{Type: "Demon", MinDifficulty: 1},
	0x28: Entity{Type: "Mage", MinDifficulty: 1},

	0x29: Entity{Type: "Troll", MinDifficulty: 2},
	0x2A: Entity{Type: "Orc", MinDifficulty: 2},
	0x2B: Entity{Type: "Bat", MinDifficulty: 2},
	0x2C: Entity{Type: "Demon", MinDifficulty: 2},
	0x2D: Entity{Type: "Mage", MinDifficulty: 2},
}

type Fog struct {
	Color uint32  `json:"color"`
	Near  float32 `json:"near"`
	Far   float32 `json:"far"`
}

func main() {
	indent := flag.Bool("indent", false, "indent JSON output")
	flag.Parse()
	c3dmap := ReadC3DMap(flag.Arg(0))
	descriptions := ReadDescriptions(flag.Arg(1))
	for i, desc := range descriptions {
		LayoutDict[byte(0xB4+i)] = Description(desc)
	}
	nextRune := 'A'
	byteToLetter := make(map[byte]string)
	letterToDef := make(map[string]LayoutDef)

	c3dname := filepath.Base(flag.Arg(0))
	c3dname = strings.TrimSuffix(c3dname, filepath.Ext(c3dname))
	nameTokens := strings.SplitN(strings.Replace(c3dname, "_", " ", -1), " ", 2)
	levelNo, err := strconv.Atoi(nameTokens[0])
	if err != nil {
		panic(err)
	}

	// Treasure is worth more on later levels
	treasure := EntityDict[0x15]
	treasure.Value = levelNo * 100
	EntityDict[0x15] = treasure

	m := JsonMap{
		Title:       nameTokens[1],
		LevelNumber: levelNo,
		Width:       c3dmap.Width,
		Height:      c3dmap.Height,
		Layout:      make([]string, c3dmap.Height),
	}
	for h := 0; h < int(m.Height); h++ {
		for w := 0; w < int(m.Width); w++ {
			idx := w + h*int(m.Width)
			b := c3dmap.Layout[idx]
			e := c3dmap.Entities[idx]

			// Entity (plane 2)
			if e > 0 {
				entity, exists := EntityDict[e]
				if !exists {
					panic(fmt.Sprint("unknown entity ", e, " at ", w, h))
				}
				entity.Position = Vec2{w, h}
				if entity.Type == "WarpGate" {
					levelNo = int(b - 0xB4) // Plane 0 value denotes destination
					if levelNo == 0 {
						levelNo = m.LevelNumber + 1
					}
					if levelNo < 0 || levelNo > 20 {
						panic("warp gate number out of bounds")
					}
					entity.Value = levelNo

					// Set plane 0 value to adjacent floor description
					var adjacentFloor byte
					for _, i := range c3dmap.Adjacent(idx) {
						f := c3dmap.Layout[i]
						if f >= 0xB4 {
							if adjacentFloor == 0 {
								adjacentFloor = f
							} else if adjacentFloor != f {
								panic("adjacent floor assumption is incorrect")
							}
						}
					}
					b = adjacentFloor
				}
				m.Entities = append(m.Entities, entity)
			}

			// Layout (plane 0)
			if s, ok := byteToLetter[b]; ok {
				m.Layout[h] += s
			} else {
				s := " "
				def := LayoutDict[b]
				if len(def.Value) > 0 {
					s = string(nextRune)
					letterToDef[s] = def
					if nextRune == 'Z' {
						nextRune = 'a'
					} else {
						nextRune += 1
					}
				}
				m.Layout[h] += s
				byteToLetter[b] = s
			}
		}
	}
	m.Legend = letterToDef

	// Fog
	far := float32(m.Width)
	if m.Height > m.Width {
		far = float32(m.Height)
	}
	far *= 1.25
	if far < 40 {
		far = 40
	}
	fog := Fog{
		Color: 0x000000,
		Near:  1,
		Far:   far,
	}
	if m.LevelNumber >= 19 {
		fog.Color = 0xFF0000
	}
	m.Fog = &fog

	var out []byte
	if *indent {
		out, err = json.MarshalIndent(m, "", "\t")
	} else {
		out, err = json.Marshal(m)
	}
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
}
