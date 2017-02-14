package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io/ioutil"
)

func main() {
	exe, err := ioutil.ReadFile("cat3d.exe")
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

	dict_last_bytes := []byte{0xFD, 0x01, 0x00, 0x00, 0x00, 0x00}

	egadict_end_idx := bytes.LastIndex(exe, dict_last_bytes) + len(dict_last_bytes)
	egadict_start_idx := egadict_end_idx - 1024
	fmt.Printf("%#x to %#x\n", egadict_start_idx, egadict_end_idx)
	err = ioutil.WriteFile("EGADICT.C3D", exe[egadict_start_idx:egadict_end_idx], 0666)
	if err != nil {
		panic(err)
	}

	audiohead_last_bytes := make([]byte, 4)
	binary.LittleEndian.PutUint32(audiohead_last_bytes, 5062)
	//audiohead_last_bytes = audiohead_last_bytes[:3]

	audiohead_end_idx := bytes.LastIndex(exe, audiohead_last_bytes) + len(audiohead_last_bytes)
	audiohead_start_idx := bytes.LastIndex(exe[:audiohead_end_idx], []byte{0x00, 0x00, 0x00, 0x00})
	fmt.Printf("%#x to %#x (%v bytes)\n", audiohead_start_idx, audiohead_end_idx, audiohead_end_idx-audiohead_start_idx)
	err = ioutil.WriteFile("AUDIOHEAD.C3D", exe[audiohead_start_idx:audiohead_end_idx], 0666)
	if err != nil {
		panic(err)
	}

	space := exe[:egadict_start_idx]
	audiodict_end_idx := bytes.LastIndex(space, dict_last_bytes) + len(dict_last_bytes)
	audiodict_start_idx := audiodict_end_idx - 1024
	fmt.Printf("%#x to %#x\n", audiodict_start_idx, audiodict_end_idx)
	err = ioutil.WriteFile("AUDIODICT.C3D", space[audiodict_start_idx:audiodict_end_idx], 0666)
	if err != nil {
		panic(err)
	}
}
