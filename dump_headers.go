package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io/ioutil"
)

func main() {
	exe, err := ioutil.ReadFile("CAT3D.EXE")
	if err != nil {
		panic(err)
	}
	egahead_last_bytes := make([]byte, 4)
	binary.LittleEndian.PutUint32(egahead_last_bytes, 256899)
	egahead_last_bytes = egahead_last_bytes[:3]

	egahead_end_idx := bytes.LastIndex(exe, egahead_last_bytes) + len(egahead_last_bytes)
	egahead_start_idx := bytes.LastIndex(exe[:egahead_end_idx], []byte{0x00, 0x00, 0x00})
	fmt.Printf("%#x to %#x (%v bytes)\n", egahead_start_idx, egahead_end_idx, egahead_end_idx-egahead_start_idx)
	err = ioutil.WriteFile("EGAHEAD.C3D", exe[egahead_start_idx:egahead_end_idx], 0666)
	if err != nil {
		panic(err)
	}

	egadict_last_bytes := []byte{0xFD, 0x01, 0x00, 0x00, 0x00, 0x00}
	egadict_end_idx := bytes.LastIndex(exe, egadict_last_bytes) + len(egadict_last_bytes)
	egadict_start_idx := egadict_end_idx - 1024
	fmt.Printf("%#x to %#x\n", egadict_start_idx, egadict_end_idx)
	err = ioutil.WriteFile("EGADICT.C3D", exe[egadict_start_idx:egadict_end_idx], 0666)
	if err != nil {
		panic(err)
	}
}
