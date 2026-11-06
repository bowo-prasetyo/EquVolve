<p align="center"><img src="assets/logo-mark.svg" width="96" height="96" alt="Logo EquVolve: pohon ekspresi berbentuk huruf V"></p>

# EquVolve

*Saksikan persamaan berevolusi.* EquVolve (dibaca **EK-yu-volv**) menggabungkan kata *equation* (persamaan) dan *evolve* (berevolusi).

> Ini terjemahan bahasa Indonesia dari [README berbahasa Inggris](https://github.com/bowo-prasetyo/equvolve/blob/main/README.md). Jika ada perbedaan, versi bahasa Inggris yang berlaku. Bagian untuk pengembang hanya diringkas di sini.

**EquVolve menemukan rumus yang cocok dengan data Anda, dan Anda bisa menyaksikan prosesnya.** Berikan sebuah rumus atau berkas CSV berisi angka, lalu EquVolve membiakkan rumus-rumus kandidat, mempertahankan yang paling cocok, dan memperbaikinya generasi demi generasi, sambil menampilkan kurva yang dicocokkan dan pohon rumusnya di layar. Metode ini disebut *pemrograman genetik* (*genetic programming*, GP), dan menemukan rumus dengan cara ini disebut *regresi simbolik*.

EquVolve dibuat untuk **belajar dan menjelajahi** cara kerja GP, dan untuk keperluan praktis ringan, seperti mencocokkan rumus dengan dataset kecil. Semuanya berjalan di peramban Anda: tidak perlu memasang apa pun, tanpa server, dan data Anda tidak pernah meninggalkan komputer Anda.

- Demo langsung: [bowo-prasetyo.github.io/equvolve](https://bowo-prasetyo.github.io/equvolve/#/)
- Repositori: [github.com/bowo-prasetyo/equvolve](https://github.com/bowo-prasetyo/equvolve)

---

## Fitur

- **Dua jenis data:** rumus target yang disampel pada suatu rentang `x`, atau berkas CSV Anda sendiri.
- **Beberapa masukan:** CSV boleh memiliki hingga 10 kolom masukan; Anda memilih kolom mana yang diprediksi.
- **Evolusi langsung** di latar belakang, sehingga halaman tetap responsif. Mode cepat menjalankan banyak generasi di antara pembaruan layar; mode lambat menampilkan setiap generasi.
- **Putar ulang:** telusuri atau putar setiap perbaikan dalam sebuah proses, sambil melihat rumus, kecocokan, dan pohonnya berubah.
- **Hasil yang mudah dibaca:** rumus terbaik disederhanakan sebelum ditampilkan (`(2.469 + ((-2.507 + x*x) - -1.712))` menjadi `pow(x, 2) + 1.674`), digambar sebagai pohon, dan diplot di atas data.
- **Grafik kemajuan:** seberapa cocok rumus terbaik dan rumus yang umum, generasi demi generasi, dibandingkan dengan target Anda.
- **Ekspor:** salin rumus terbaik sebagai teks biasa, JavaScript, Python, atau LaTeX.
- **Tautan berbagi:** sekali klik menyalin tautan berisi pengaturan, data (hingga 2.000 baris), dan rumus terbaik.
- **Pencarian yang dapat diatur:** populasi, generasi, target kecocokan, laju evolusi, kedalaman pohon, dan 23 operator dengan prasetel.
- **Bahasa Indonesia dan Inggris:** antarmuka mengikuti bahasa peramban Anda; menu di bilah atas mengganti bahasa seketika, dan pilihan Anda diingat di peramban ini.
- **Tema terang dan gelap:** seluruh halaman, termasuk grafik, mengikuti pengaturan perangkat Anda secara bawaan; tombol di bilah atas berganti antara Otomatis, Terang, dan Gelap, dan pilihannya diingat di peramban ini.
- **Hentikan, lanjutkan, dan pulihkan:** hentikan proses, ubah pengaturan, lalu teruskan. Proses Anda disimpan di peramban, sehingga tetap ada setelah tab ditutup.
- **Pemeriksaan sebelum berjalan:** rumus, rentang, atau pengaturan yang tidak valid dilaporkan sebelum proses dimulai, semuanya sekaligus dan di samping pengaturan yang perlu diperbaiki. Jika rumus Anda memakai operator yang tidak dicentang (seperti `/` dalam `x*x + 2/x`), aplikasi memberi tahu dan mencentangnya untuk Anda dengan sekali klik.

---

## Mulai cepat

1. Buka [demo langsung](https://bowo-prasetyo.github.io/equvolve/#/).
2. Biarkan rumus bawaan `x*x + 2` lalu tekan **Mulai Evolusi**. Rumus itu ditemukan pada generasi pertama.
3. Sekarang yang butuh sedikit lebih lama: ubah rumus menjadi `x*x + 2/x`. Aplikasi menunjukkan bahwa rumus ini memakai `/`, yang tidak dicentang: tekan **Centang /** (atau prasetel operator **Rasional**), lalu **Mulai Evolusi**. Pada grafik kemajuan, garis merah turun bertahap menuju garis target hijau putus-putus, biasanya dalam 100 generasi.
4. Setelah berhenti, tekan **▶ Putar ulang** untuk melihat bagaimana rumus membaik selama proses.
5. Siap untuk yang sulit? Coba `sin(x) * exp(x/3)` dengan prasetel **Semua**. Biasanya proses berhenti di Generasi Maks sedikit di bawah target; [Jika proses tidak mencapai target](#jika-proses-tidak-mencapai-target) menjelaskan langkah selanjutnya.

---

## Konsep utama

- **Program:** satu rumus kandidat, tersusun dari operator (seperti `+` atau `sin`), variabel masukan, dan angka. EquVolve menampilkan setiap program sebagai rumus dan sebagai pohon.
- **Populasi:** semua program yang dicoba sekaligus (200 secara bawaan).
- **Generasi:** satu putaran evolusi. Program-program terbaik dipertahankan, digabungkan, dan sedikit diubah untuk membentuk populasi berikutnya.
- **R² (kecocokan):** seberapa baik sebuah program sesuai dengan data. 1 berarti cocok sempurna, 0 tidak lebih baik daripada selalu memprediksi rata-rata, dan di bawah 0 lebih buruk lagi. Proses berhenti begitu program terbaik mencapai **Target R²** (0,999 secara bawaan).
- **Program terbaik:** program dengan kecocokan terbaik sejauh ini. Skor setiap program mencakup sedikit penalti untuk ukurannya, sehingga hasilnya tetap pendek dan mudah dibaca.

---

## Cara memakai

Aplikasi memiliki tiga panel bernomor: **1. Data**, **2. Pengaturan**, dan **3. Hasil**, dengan tombol-tombol proses di antara Pengaturan dan Hasil. Sampai Anda menggulir ke sana, tombol-tombol itu tetap berada di bagian bawah jendela, sehingga **Mulai Evolusi** selalu tinggal sekali klik, di ponsel juga.

### 1. Data: apa yang dicocokkan

Pilih **sumber data**.

**Buat dari rumus:** masukkan rumus dan rentang X.

- Tulis rumus dalam `x`, dengan angka, tanda kurung `( )`, `+ - * /`, dan fungsi matematika seperti `sin(x)`, `pow(x, 2)`, `exp(-x*x)`, `abs(x)`, atau `PI * x`. Setiap nama pada `Math` milik JavaScript dapat dipakai, dengan atau tanpa `Math.` di depannya.
- Hasil memakai notasi yang sama, sehingga Anda dapat menempelkan hasil kembali sebagai rumus baru. Rumus selalu memakai titik desimal (`0.5`), dalam bahasa apa pun.
- **Titik sampel** (101 secara bawaan) tersebar merata di sepanjang rentang X, termasuk kedua ujungnya. Inilah titik-titik yang coba dicocokkan oleh proses.

<details>
<summary>Rincian rumus</summary>

- Juga diperbolehkan: koma (seperti dalam `pow(x, 2)`), `%`, dan `**`. Selain itu tidak ada yang diterima (tidak ada nama lain, string, kurung siku, atau pernyataan), sehingga rumus dalam tautan berbagi tidak dapat menjalankan kode lain.
- Titik Sampel boleh dari 2 sampai 10.000. Grafik menandai paling banyak sekitar 60 titik, tetapi proses memakai semuanya.
- Titik tempat rumus tidak memiliki nilai hingga (misalnya `1/x` pada `x = 0`) dilewati. Sedikitnya dua titik harus tersisa.

</details>

**Unggah dataset:** pilih berkas CSV berisi angka, biasanya dengan baris judul:

```csv
height,width,depth,price
1.5,4.4,4.1,27.4
2.0,3.0,2.8,22.7
```

- Satu kolom menjadi **target**, yaitu nilai yang diprediksi: secara bawaan kolom terakhir. Dengan tiga kolom atau lebih, menu **Kolom target** memungkinkan Anda memilih kolom lain.
- Setiap kolom lainnya menjadi **masukan**, dinamai sesuai judulnya (hingga 10 masukan).
- Dengan **satu masukan**, namanya `x`, dan grafik menampilkan data beserta kurva yang dicocokkan. Dengan **beberapa masukan**, grafik menampilkan nilai prediksi setiap baris terhadap nilai aktualnya.
- Baris dengan sel kosong, sel yang kurang atau berlebih, atau teks alih-alih angka dilewati. Aplikasi menyebutkan berapa banyak, baris mana dalam berkas, dan alasannya (misalnya *2 baris dilewati: baris 4 (ada sel kosong); baris 9 (berisi teks, bukan angka).*).
- Setelah dimuat, **pratinjau** menampilkan lima baris pertama sebagaimana dibaca EquVolve, dengan kolom target ditandai, sehingga Anda dapat memeriksa kolom-kolomnya sebelum menjalankan proses.
- Tidak punya berkas? **Gunakan data contoh** memuat contoh kecil (harga kotak berdasarkan tinggi, lebar, dan dalamnya), dan **Unduh CSV contoh** menyimpannya, untuk melihat formatnya atau dipakai sebagai templat.

<details>
<summary>Rincian CSV</summary>

- Koma, titik koma, dan tab semuanya dapat dipakai sebagai pemisah. Satu berkas memakai satu pemisah di seluruh isinya, yang dikenali dari baris pertamanya (tab jika ada, jika tidak titik koma, jika tidak koma); jika bukan koma, aplikasi menyebutkan pemisah yang ditemukan di bawah berkas yang dimuat.
- **Koma desimal** dapat dipakai dalam berkas yang dipisahkan titik koma atau tab, seperti yang disimpan oleh spreadsheet dengan pengaturan bahasa Indonesia, Jerman, atau Prancis: `1,5` dibaca sebagai satu setengah. Dalam berkas yang dipisahkan koma, angka harus memakai titik desimal. Pemisah ribuan (`1.234,5`) tidak didukung; baris seperti itu dilaporkan sebagai teks.
- Sel dalam tanda kutip ganda boleh berisi pemisah (`"Height, cm"`), dan `""` di dalam tanda kutip berarti satu tanda kutip. *Byte order mark* UTF-8, yang ditambahkan Excel pada berkas *CSV UTF-8*, diabaikan.
- Jika baris pertama seluruhnya berisi angka, baris itu dianggap data, dan kolom-kolomnya dinamai `x1`, `x2`, … dan `y`.
- Hanya 10 kolom masukan pertama yang digunakan; kolom setelahnya diabaikan, dan aplikasi menyebutkannya di bawah berkas yang dimuat. Baris dengan sel lebih banyak daripada judulnya dilewati (*sel terlalu banyak*), karena nilainya tidak sejajar dengan kolom; satu pemisah di akhir baris tidak masalah.
- Nama masukan dibersihkan menjadi huruf, angka, dan `_`, sehingga `Height (cm)` menjadi `Height_cm`. Nama yang diawali angka, atau bentrok dengan nama `Math` atau kata kunci JavaScript atau Python, diberi awalan `v_` (`sin` menjadi `v_sin`). Nama yang berulang diberi tambahan `_2`, `_3`, ….
- Dengan beberapa masukan, grafik menggambar hingga 400 baris.

</details>

### 2. Pengaturan: cara mencari

Setiap pengaturan memiliki penjelasan singkat di bawahnya dalam aplikasi. Biasanya Anda hanya memerlukan **Generasi Maks**, **Target R²**, **Kecepatan**, dan **Operator**, jadi hanya itu yang ditampilkan. Sisanya untuk menjelajahi perilaku GP dan berada di bawah **Pengaturan lanjutan**, yang menyebutkan berapa banyak di antaranya yang telah Anda ubah dari bawaan. Bagian itu terbuka sendiri jika salah satunya bermasalah.

| Pengaturan         | Fungsinya                                                                                        | Bawaan  |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| Generasi Maks      | Proses dijeda setelah sekian generasi. Anda dapat menaikkannya lalu menekan **Lanjutkan**.        | 500     |
| Target R²          | Proses berhenti begitu program terbaik mencapai kecocokan ini (1 = sempurna, paling tinggi 1).   | 0,999   |
| Kecepatan          | **Cepat:** sebanyak mungkin generasi dalam sekitar 40 ms per pembaruan layar. **Lambat:** satu generasi per pembaruan, sekitar 6 per detik, untuk diamati. | Cepat |
| Operator           | Blok penyusun yang boleh dipakai program.                                                         | `+ - *` |
| Ukuran Populasi *(lanjutan)* | Berapa banyak program yang dicoba sekaligus. Lebih banyak bisa menemukan rumus yang lebih sulit, tetapi setiap generasi lebih lambat (sedikitnya 2). | 200 |
| Laju Pindah Silang *(lanjutan)* | Seberapa sering (0–1) program baru menggabungkan bagian dari dua program yang baik, alih-alih menyalin satu program. | 0,7 |
| Laju Mutasi *(lanjutan)* | Seberapa sering (0–1) program baru kemudian mendapat sedikit perubahan acak.                     | 0,1     |
| Laju Elitisme *(lanjutan)* | Bagian (0–1) dari program terbaik yang dipertahankan tanpa perubahan ke generasi berikutnya.    | 0,05    |
| Ukuran Turnamen *(lanjutan)* | Induk dipilih dengan mempertandingkan sekian program acak. Nilai yang lebih besar makin mengunggulkan program terbaik (sedikitnya 1). | 5 |
| Kedalaman Pohon Awal *(lanjutan)* | Seberapa dalam susunan program acak di awal proses (1–12).                                | 4       |
| Kedalaman Pohon Maks *(lanjutan)* | Seberapa dalam susunan program mana pun boleh tumbuh (dari Kedalaman Pohon Awal sampai 17). Ini mencegah program terus membesar tanpa menjadi lebih cocok. | 8 |
| Penskalaan linear *(lanjutan)* | Setiap program boleh diregangkan dan digeser (`a + b·f(x)`) agar cocok dengan data, sehingga evolusi hanya perlu menemukan bentuk yang tepat. Biarkan aktif kecuali Anda sedang mempelajari GP tanpanya. | aktif |
| Optimasi konstanta *(lanjutan)* | Eksperimental: setel halus angka-angka di dalam 10% program acak di setiap generasi. Dalam tolok ukur kami, fitur ini tidak memperbaiki hasil (lihat [Cara kerja](#optimasi-konstanta-eksperimental)). | nonaktif |

**Jika rumus memerlukan operator yang tidak dicentang**, sebuah catatan di atas tombol proses menyebutkannya, dengan tombol untuk mencentangnya (misalnya **Centang /**). Pangkat bulat seperti `pow(x, 2)` atau `x**3` hanya memerlukan `*`. Fungsi matematika yang bukan operator, seperti `abs`, juga ditunjukkan: proses hanya dapat mendekatinya.

**Prasetel operator:** Polinomial (`+ - *`), Rasional (menambahkan `/`), Trigonometri (menambahkan `sin cos`), Exp / Log (menambahkan `exp log`), dan Semua. Pilih prasetel yang sesuai dengan bentuk data Anda; sedikit operator yang dipilih dengan baik biasanya menemukan rumus lebih cepat daripada Semua.

<details>
<summary>Ke-23 operator</summary>

- Biner: `+`, `-`, `*`, `/`, `pow`
- Uner: `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `log` (logaritma natural), `log2`, `log10`, `exp`, `sqrt`, `cbrt`

Laju bawaan dipilih dengan tolok ukur yang dijelaskan di [Contoh hasil](#contoh-hasil). Pindah silang 0,8, mutasi 0,2, dan elitisme 0,02 sedikit lebih buruk pada target-target yang lebih sulit.

</details>

### Mulai, hentikan, dan lanjutkan

| Keadaan    | Tombol                                                               | Pengaturan                                         |
| ---------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| diam       | **Mulai Evolusi**                                                    | Dapat diubah.                                      |
| berjalan   | **Berjalan…** (nonaktif), **Hentikan**                               | Terkunci.                                          |
| dijeda     | **Lanjutkan**, **Proses baru**, **Salin tautan berbagi**, dan **Hapus Hasil** yang lebih samar | Dapat diubah; **Lanjutkan** meneruskan dengan perubahan Anda. |

- Tombol yang disorot adalah langkah berikutnya yang berguna. Setelah **Hentikan**, tombol itu adalah **Lanjutkan**. Jika melanjutkan akan langsung berhenti lagi, karena proses sudah di Generasi Maks atau sudah mencapai Target R², tombol itu adalah **Proses baru**, dan catatan di bawah tombol menyebutkan pengaturan mana yang perlu dinaikkan untuk meneruskan. Setelah kecocokan sempurna (R² 1) tidak ada lagi yang bisa diperbaiki, jadi catatan itu menyarankan **Proses baru**.
- Proses dijeda sendiri saat mencapai Target R² atau Generasi Maks, dan sebuah pesan menyebutkan yang mana. Untuk meneruskan setelah Generasi Maks, naikkan nilainya lalu tekan **Lanjutkan**.
- **Proses baru** memulai lagi dari awal dengan pengaturan saat ini.
- **Hapus Hasil** langsung menghapus hasil dan proses yang tersimpan, siap untuk proses baru.
- Setelah **Proses baru** atau **Hapus Hasil**, tombol pembatalan (**Urungkan proses baru** atau **Urungkan**) mengembalikan proses sebelumnya, dalam keadaan dijeda, dengan pengaturan yang dipakainya, sampai Anda memulai atau melanjutkan proses lain.
- Pengaturan diperiksa saat Anda menekan **Mulai Evolusi**, **Proses baru**, atau **Lanjutkan**. Setiap masalah dicantumkan di atas tombol dan ditampilkan di samping pengaturannya, dan kursor berpindah ke masalah pertama. Daftar itu diperbarui saat Anda memperbaikinya; klik sebuah masalah untuk menuju pengaturannya.
- **Salin tautan berbagi** muncul setiap kali ada hasil yang ditampilkan dan tidak ada proses yang berjalan, termasuk setelah Anda membuka tautan berbagi.

### 3. Hasil: cara membacanya

- **R² terbaik:** seberapa cocok program terbaik, beserta artinya dalam kata-kata: *Kecocokan istimewa* (0,999 atau lebih), *Kecocokan sangat baik* (0,99), *Kecocokan baik* (0,9), *Kecocokan kasar* (0,5), *Kecocokan buruk* (0 atau lebih), atau *Lebih buruk daripada menebak rata-rata* (di bawah 0).
- **Program terbaik:** rumus terbaik sejauh ini. Tab-tabnya menampilkannya sebagai rumus biasa, JavaScript, Python, atau LaTeX, dan **Salin** menaruh isi tab yang aktif ke papan klip. Dengan beberapa masukan, fungsi yang diekspor menerimanya sebagai parameter, misalnya `(height, width, depth) => …`.
- **Putar ulang:** setelah proses (atau saat dijeda), **▶ Putar ulang** memutar setiap perbaikan, dan penggeser dapat melompat ke perbaikan mana pun. Rumus, ekspor, grafik kecocokan, dan pohon semuanya mengikuti putar ulang, dan grafik kemajuan menandai generasinya dengan warna biru. **Kembali ke terbaru** kembali ke program terbaik saat ini.
- **Grafik kecocokan:** dengan satu masukan, data (titik sian) dan program terbaik (kurva merah). Sumbunya memiliki nilai skala yang bulat dan diberi judul nama masukan dan target (`x` dan `y`, atau nama kolom CSV). Dengan beberapa masukan, nilai prediksi setiap baris terhadap nilai aktualnya, pada sumbu berjudul *aktual* dan *prediksi* (dengan nama target); titik pada diagonal merah diprediksi dengan tepat. Kedua grafik menyesuaikan lebar layar dan tetap tajam pada layar beresolusi tinggi.
- **Grafik kemajuan:** seberapa dekat program terbaik (merah) dan program median (abu-abu) dengan kecocokan sempurna di setiap generasi. Skalanya menampilkan R² 0,9, 0,99, 0,999 … dengan jarak yang sama, sehingga perbaikan kecil di akhir sama terlihatnya dengan perbaikan besar di awal. Garis hijau putus-putus adalah Target R² Anda.
- **Pohon ekspresi:** program terbaik sebagai pohon. Setiap simpul diberi label operator, variabel, atau angkanya; operator berwarna oranye, variabel hijau, dan angka khaki. Simpul membesar sesuai labelnya, dan angka yang panjang dipersingkat (`1.76e-6`): arahkan penunjuk ke angka itu untuk melihat semua digitnya.
- **Ukuran program:** berapa banyak simpul dalam pohon.
- **Kecepatan:** generasi per detik.
- **Generasi terakhir:** program terbaik pada masing-masing lima pembaruan layar terakhir, yang terbaru di atas.

Angka-angka hasil ditulis sesuai bahasa antarmuka (0,999 dalam bahasa Indonesia), tetapi rumus dan ekspor selalu memakai titik desimal, agar dapat langsung dipakai dalam kode.

<details>
<summary>Rincian ekspor</summary>

- Ekspor JavaScript dan Python menyimpan 12 angka penting; rumus biasa dan LaTeX menampilkan 5, seperti rumus di layar.
- Python menulis pangkat sebagai `**`, dan program yang memakai `cbrt` mendapat komentar bahwa `math.cbrt` memerlukan Python 3.11 atau lebih baru.
- Dalam mode Cepat, satu pembaruan layar mencakup banyak generasi, jadi **Generasi terakhir** melewatkan sebagian.
- Skala grafik kemajuan berhenti di R² 0,999999; kecocokan yang lebih baik digambar di tepi bawahnya.

</details>

### Membagikan proses

Setelah proses, **Salin tautan berbagi** menyalin tautan yang membuka EquVolve dengan pengaturan, data, dan rumus terbaik Anda, siap dijalankan. Tautan itu juga ditampilkan dalam kotak di bawah tombol, untuk disalin secara manual bila perlu.

- Dataset yang diunggah disertakan jika berisi paling banyak 2.000 baris; jika lebih, orang yang menerima tautan diminta mengunggah berkasnya.
- Populasi proses tidak disertakan, jadi penerima memulai proses baru, bukan melanjutkan proses Anda.
- Membuka tautan tidak menyentuh proses tersimpan milik pengunjung sampai mereka memulai proses baru.

### Memulihkan setelah peramban ditutup

Proses Anda disimpan di peramban ini selama berjalan. Saat Anda kembali, sebuah spanduk di bagian atas halaman menawarkannya, dengan keterangan apa yang dicocokkan, seberapa jauh kemajuannya, dan kapan disimpan. **Pulihkan proses** mengembalikannya dalam keadaan dijeda, beserta hasil, grafik, putar ulang, pengaturan, dan datanya: tekan **Lanjutkan** untuk meneruskan. **Nanti saja** tetap menyimpannya untuk kunjungan berikutnya, dan halaman dapat langsung dipakai selama spanduk ditampilkan; memulai proses baru akan menggantikan proses yang tersimpan. Lihat [Penyimpanan](#penyimpanan) untuk apa saja yang disimpan.

---

## Jika proses tidak mencapai target

Proses bersifat acak, dan sebagian rumus sulit ditemukan. Berhenti di Generasi Maks bukanlah kesalahan: program terbaik sejauh ini tetap ditampilkan, dan R² 0,99 sering kali sudah merupakan kecocokan yang dekat (periksa grafik kecocokan). Untuk mendekat lagi, coba langkah berikut secara berurutan:

1. **Naikkan Generasi Maks lalu tekan Lanjutkan.** Proses berlanjut dari tempat ia berhenti. Target yang sulit bisa memerlukan 1.000 generasi atau lebih.
2. **Pilih operator yang sesuai dengan bentuk data:** Trigonometri untuk gelombang, Exp / Log untuk pertumbuhan, peluruhan, atau kurva lonceng, Rasional untuk rumus dengan pembagian. Beberapa operator yang tepat biasanya lebih baik daripada Semua.
3. **Mulai lagi** dengan **Proses baru** (**Urungkan** mengembalikan proses lama jika yang baru lebih buruk). Setiap proses berbeda, dan proses baru mungkin cepat menemukan rumusnya.
4. **Perbesar Ukuran Populasi**, misalnya menjadi 500. Setiap generasi lebih lambat, tetapi pencarian mencoba lebih banyak sekaligus.
5. **Terima Target R² yang sedikit lebih rendah**, misalnya 0,99, jika kecocokan yang dekat sudah cukup.

### Pesan

| Pesan                                                          | Yang perlu dilakukan                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Berhenti di Generasi Maks (…)                                  | Lihat daftar di atas.                                                                        |
| Rumus tidak valid: nama tidak dikenal "…"                      | Pakai `x` sebagai variabel, dan hanya nama matematika seperti `sin`, `exp`, atau `PI`.        |
| Rumus menghasilkan kurang dari 2 nilai hingga di Rentang X     | Ubah rentang X: misalnya, `log(x)` dan `sqrt(x)` memerlukan `x` positif.                      |
| Nilai target konstan                                           | Data harus bervariasi; garis datar tidak memiliki apa pun untuk dicocokkan.                   |
| CSV memerlukan sedikitnya dua kolom angka                      | Pastikan berkas memiliki sedikitnya dua kolom angka, dipisahkan dengan koma, titik koma, atau tab. |
| Unggah dataset CSV dengan sedikitnya 2 baris yang valid        | Unggah berkas, atau periksa barisnya: baris dengan sel kosong atau teks dilewati.             |
| … baris dilewati: … (sel terlalu banyak)                       | Baris itu berisi lebih banyak nilai daripada kolom judulnya. Dalam berkas yang dipisahkan koma, ini biasanya berarti angka ditulis dengan koma desimal: simpan berkas dengan titik koma sebagai pemisah, atau pakai titik desimal. |
| Pilih sedikitnya satu operator                                 | Centang sebuah operator, atau tekan sebuah prasetel.                                         |
| Rumus Anda memakai …, yang tidak dicentang di Operator         | Tekan tombol **Centang …** di sampingnya, atau prasetel yang mencakupnya. Tanpanya, proses hanya dapat mendekati rumus itu. |
| … tidak tersedia sebagai operator, sehingga proses hanya dapat mendekatinya | Rumus memakai fungsi matematika yang bukan salah satu dari 23 operator, seperti `abs`. Tidak ada yang perlu diperbaiki: proses tetap berjalan, tetapi menemukan pendekatan yang tersusun dari operator yang dicentang. |
| Tautan berbagi ini tidak dapat dibaca                          | Tautannya mungkin tidak lengkap; salin lagi.                                                  |

---

## Cara kerja

### Representasi

Program adalah pohon ekspresi. Daunnya berupa variabel masukan (`x`, atau nama kolom dataset) atau konstanta acak yang diambil secara seragam dari [-10, 10] dengan tiga angka desimal; daun baru berupa variabel atau konstanta dengan peluang yang sama. Simpul internalnya adalah operator yang diaktifkan. Sebuah daun memiliki kedalaman 0.

Generasi pertama dibuat dengan *ramped half-and-half*: kedalaman 2 sampai Kedalaman Pohon Awal (hanya 1 jika Kedalaman Pohon Awal adalah 1), separuh "full" (setiap cabang sampai kedalaman maksimum) dan separuh "grow" (cabang boleh berhenti lebih awal), sehingga proses dimulai dengan bentuk yang sangat beragam.

### Kebugaran (fitness)

Setiap program `f` dievaluasi pada setiap titik latih dan dinilai dengan R², yaitu bagian dari variansi data yang dijelaskannya.

Dengan **penskalaan linear** (Keijzer, 2003), program dinilai sebagai `a + b·f(x)`, dengan `a` dan `b` adalah kecocokan kuadrat terkecil terbaik, yang dihitung secara tepat untuk setiap program. Evolusi hanya perlu menemukan bentuk yang tepat; ia tidak pernah perlu kebetulan menemukan geseran dan skala yang tepat dengan memutasi konstanta. Program yang dilaporkan sudah mencakup `a` dan `b`, yang dilebur ke dalam konstantanya sendiri oleh penyederhana.

```
fitness = (1 − R²) + 0.001 × (jumlah simpul)
```

Penalti ukuran yang kecil mencegah program membengkak (*bloat*). Program yang menghasilkan nilai tak hingga (misalnya pembagian dengan nol) di titik latih mana pun mendapat kebugaran tak hingga. R² tidak terdefinisi untuk target yang konstan, jadi target konstan ditolak sejak awal.

### Setiap generasi

1. Urutkan populasi berdasarkan kebugaran. Jika optimasi konstanta aktif, optimalkan dulu 10% program acak (lihat di bawah). Catat R² terbaik dan median untuk grafik kemajuan, dan tambahkan program terbaik ke garis waktu putar ulang jika berubah.
2. Berhenti jika R² terbaik ≥ Target R², atau batas generasi tercapai.
3. Bentuk generasi berikutnya yang berisi tepat *Ukuran Populasi* program:
   - **Elit:** bagian teratas sebesar *Laju Elitisme*, disalin tanpa perubahan.
   - **Pendatang:** 10% program acak yang benar-benar baru, untuk menjaga keragaman.
   - **Keturunan:** sisanya. Masing-masing memilih induk melalui seleksi turnamen. Dengan peluang *Laju Pindah Silang*, sebuah subpohon acak dari induk itu diganti dengan subpohon acak dari induk kedua (90% dari waktu dipilih simpul operator, sehingga pindah silang benar-benar memindahkan struktur). Anak yang lebih dalam daripada Kedalaman Pohon Maks ditolak dan pindah silang diulang; setelah 5 kali gagal, induk pertama disalin. Selain itu, induk disalin tanpa perubahan. Kemudian, dengan peluang *Laju Mutasi*, anak itu dimutasi.
4. Mutasi, dengan peluang yang sama, berupa:
   - **mutasi subpohon:** sebuah simpul acak diganti dengan subpohon "grow" acak yang baru, tidak lebih dalam daripada Kedalaman Pohon Awal dan tidak pernah membuat program melewati Kedalaman Pohon Maks; atau
   - **mutasi titik:** satu simpul acak berubah. Operator menjadi operator lain yang diaktifkan dengan aritas yang sama (jika ada). Konstanta biasanya (70% dari waktu) digeser dengan langkah acak kasar, sedang, atau halus (hingga ±1×, ±0,1×, atau ±0,01× besarnya; besar di bawah 1 dihitung sebagai 1), sehingga konstanta dapat dipindahkan sekaligus disetel halus. Daun lainnya diganti dengan daun acak baru: variabel atau konstanta.

### Optimasi konstanta (eksperimental)

Penskalaan linear mencocokkan geseran dan skala luar sebuah program, tetapi tidak konstanta di dalam fungsi, seperti `1/3` dalam `exp(x/3)`. Jika diaktifkan, optimasi konstanta menyetelnya dengan strategi evolusi (1+1) yang singkat:

1. Semua konstanta program diusik dengan derau Gaussian.
2. Perubahan dipertahankan jika kebugaran membaik.
3. Ukuran langkah setiap konstanta membesar setelah berhasil dan mengecil setelah gagal.

Konstanta yang diperbaiki ditulis kembali ke populasi. Setiap generasi, 10% program acak masing-masing mendapat 10 langkah.

**Fitur ini nonaktif secara bawaan karena tidak membantu.** Pada tiga target dengan konstanta di dalam fungsi nonlinear (masing-masing 20 proses; R² ≥ 0,999 dalam 200 generasi):

| Strategi                                   | Tercapai | Waktu |
| ------------------------------------------ | -------- | ----- |
| Nonaktif                                   | **31 / 60** | **298 dtk** |
| 10% program acak, masing-masing 10 langkah | 26 / 60  | 912 dtk |
| Hanya program terbaik, 20 langkah          | 21 / 60  | 418 dtk |
| 3 program terbaik, 20 langkah              | 17 / 60  | –     |

Memoles konstanta program-program terbaik membuatnya memenangi sebagian besar turnamen, sehingga populasi kehilangan keragaman dan macet. Strategi acak paling sedikit merugikan, tetapi membuat waktu proses tiga kali lipat. Metode yang menjaga keragaman, seperti mengoptimalkan konstanta hanya saat pencarian mandek, masih menjadi pekerjaan ke depan.

### Kecepatan

Dalam mode **Cepat**, *worker* menjalankan generasi berturut-turut selama sekitar 40 ms, lalu mengirim satu pembaruan yang mencakup semuanya dan berhenti sejenak 5 ms. Setiap generasi tetap ditambahkan ke grafik kemajuan dan putar ulang (dengan batasan di [Keterbatasan yang diketahui](#keterbatasan-yang-diketahui)). Populasi lengkap, yang hanya diperlukan untuk titik simpan, dikirim setiap 10 generasi, saat Hentikan, dan saat selesai. Ini menggantikan jeda tetap 50 ms per generasi pada Fase 2, yang membatasi proses pada sekitar 20 generasi per detik. Populasi 200 kini berjalan sekitar 60–100 generasi per detik di peramban pada umumnya, tergantung operatornya. Mode **Lambat** mengirim setiap generasi dengan jeda 150 ms.

### Penyederhanaan

Sebelum ditampilkan atau diekspor, sebuah program disederhanakan:

- konstanta dilebur;
- suku-suku sejenis dikumpulkan (`x + x` menjadi `2 * x`, `x * x` menjadi `pow(x, 2)`);
- konstanta didistribusikan ke penjumlahan;
- faktor saling menghapus dalam pembagian (`(u / v) * v` menjadi `u`);
- identitas seperti `u * 1`, `u - u`, `u / u`, dan `pow(u, 1)` dihilangkan.

Program yang disederhanakan kemudian diperiksa terhadap program aslinya di setiap titik latih dan hanya dipakai jika menghitung nilai yang sama. Pencarian itu sendiri bekerja pada program yang belum disederhanakan.

### Penyimpanan

Sesi disimpan di IndexedDB milik peramban (`gp-db`; namanya lebih tua daripada EquVolve dan dipertahankan agar sesi lama tetap dapat dipulihkan):

- `sessions` menyimpan satu titik simpan dari proses terbaru, dengan kunci `latest`: pengaturan, dataset, generasi, seluruh populasi (pohon disimpan sebagai larik bersarang yang ringkas), program terbaik, generasi-generasi terakhir, grafik kemajuan, dan garis waktu putar ulang (hingga 300 cuplikan). Titik simpan diperiksa pada setiap pembaruan dari *worker* dan ditulis jika kebugaran terbaik membaik atau sedikitnya 10 generasi telah berlalu sejak penulisan terakhir. Titik simpan juga ditulis saat Hentikan, saat proses selesai, dan jika halaman ditutup selama proses berjalan. Populasi yang disimpan saat Hentikan atau selesai bersifat tepat; di antaranya, populasi bisa tertinggal hingga 10 generasi dari bagian lain titik simpan.
- `bestPrograms` menyimpan catatan setiap program terbaik yang baru (waktu, kebugaran, R², generasi, dan pohon). Catatan ini belum ditampilkan di antarmuka.

**Hapus Hasil** mengosongkan keduanya (**Urungkan** menulis kembali titik simpannya). Pilihan tema dan bahasa disimpan terpisah, di `localStorage` dengan kunci `equvolve-theme` dan `equvolve-language`. Semuanya tetap di peramban Anda; menghapus data situs akan menghapusnya.

### Keterbatasan yang diketahui

- **Konstanta di dalam fungsi nonlinear** (`1/3` dalam `exp(x/3)`) hanya ditemukan melalui mutasi, sehingga target seperti ini lebih jarang terpecahkan dibandingkan pada Fase 1; lihat [Contoh hasil](#contoh-hasil). Optimasi konstanta eksperimental tidak memperbaikinya.
- **Mode rumus hanya memiliki satu variabel** (`x`); beberapa variabel memerlukan CSV.
- **Penyederhana hanya bersifat aljabar.** Ia tidak mengenal identitas trigonometri atau logaritma, dan tidak memfaktorkan ekspresi.
- **Putar ulang menyimpan hingga 300 cuplikan.** Dalam proses yang lebih panjang, perbaikan di tengah-tengah dijarangkan; yang pertama dan yang terbaru selalu disimpan.
- **Grafik kemajuan menyimpan hingga 1.000 titik.** Setelah itu, setiap titik kedua dibuang (yang terbaru selalu disimpan), sehingga proses yang sangat panjang digambar dengan resolusi yang lebih kasar.

---

## Contoh hasil

`npm run bench` mengukur seberapa sering mesin mencapai R² ≥ 0,999 dalam 200 generasi, dengan pengaturan bawaan (populasi 200, penskalaan linear aktif, optimasi konstanta nonaktif), 101 titik sampel, dan x di [-3, 3]. Setiap target dijalankan 20 kali. Satu putaran lengkap memakan waktu sekitar 15 menit. GP bersifat stokastik, jadi proses Anda akan berbeda, dan selisih beberapa proses dari 20 masih dalam batas derau.

| Target              | Operator          | Fase 1 | Fase 2 | Versi ini | Median generasi | Contoh hasil (versi ini)                               |
| ------------------- | ----------------- | ------ | ------ | --------- | --------------- | ----------------------------------------------------- |
| `x*x*x - 2*x + 1`   | `+ - *`           | 6      | 20     | **20**    | 9               | `pow(x, 3) - 2 * x + 1`                               |
| `3*x*x + 2`         | `+ - *`           | 17     | 20     | **20**    | 1               | `3 * pow(x, 2) + 2`                                   |
| `x*x + 2/x`         | `+ - * /`         | 19     | 20     | **20**    | 14              | `0.9716 * pow(x, 2) + 2.0113 / x + 0.087772`          |
| `exp(-x*x/2)`       | `+ - * / exp`     | **19** | 11     | 13        | 22              | `0.99343 * exp(-0.54735 * pow(x, 2)) + 0.020478`      |
| `sin(x) + sin(x*x)` | `+ - * / sin cos` | **15** | 12     | 12        | 19              | `sin(x) + sin(pow(x, 2))`                             |
| `sin(x) * exp(x/3)` | `+ - * / sin exp` | **7**  | 5      | 3         | 12              | `1.0273 * exp(0.30728 * x) * sin(x) + 0.023183`       |
| **Total (dari 120)** |                  | 83     | 88     | **88**    |                 |                                                       |

Yang ditunjukkan tabel ini:

- **Target polinomial dan rasional selalu terpecahkan** (60/60, dibandingkan 42/60 pada Fase 1), biasanya dalam beberapa generasi saja. Penskalaan linear dan pindah silang subpohon yang melakukan pekerjaannya di sini.
- **Target dengan konstanta di dalam fungsi nonlinear** (`1/2` dalam `exp(-x*x/2)`, `1/3` dalam `exp(x/3)`) lebih jarang terpecahkan dibandingkan pada Fase 1 (28/60, dibandingkan 41/60). Fase 1 menggeser setiap konstanta pada setiap keturunan, yang kebetulan cocok untuk target-target ini. [Optimasi konstanta](#optimasi-konstanta-eksperimental) eksperimental tidak menutup selisih ini.
- **Versi ini mencari persis seperti Fase 2** (optimasi konstanta nonaktif secara bawaan), sehingga per generasi hasilnya sama dalam batas derau. Versi ini lebih cepat per detik: generasi dijalankan bertumpuk alih-alih dijeda 50 ms masing-masing.
- Bahkan ketika sebuah proses meleset dari target yang ketat, biasanya ia menemukan R² di atas 0,99. Contoh-contohnya menunjukkan hasil yang nyaris tepat, dengan bentuk yang benar tetapi konstanta yang sedikit keliru, seperti `exp(0.307x)` untuk `exp(x/3)`.

---

## Untuk pengembang

EquVolve adalah situs statis tanpa langkah *build*. Untuk menjalankannya secara lokal, sajikan foldernya melalui HTTP (peramban tidak mengizinkan Web Worker dimuat dari halaman `file://`):

```bash
git clone https://github.com/bowo-prasetyo/equvolve.git
cd equvolve
python3 -m http.server 8000
```

Lalu buka <http://localhost:8000>. Cara menjalankan pengujian (`npm test` dan `npm run test:ui`) dan tolok ukur, struktur proyek, serta peta jalan dijelaskan di [README berbahasa Inggris](https://github.com/bowo-prasetyo/equvolve/blob/main/README.md#running-locally) dan di [panduan pengembang](https://github.com/bowo-prasetyo/equvolve/blob/main/docs/DEVELOPMENT.md).

Ingin membantu menerjemahkan EquVolve ke bahasa lain, atau memperbaiki terjemahan ini? Lihat [panduan penerjemahan](https://github.com/bowo-prasetyo/equvolve/blob/main/docs/TRANSLATING.md).

---

## Lisensi

MIT. Lihat [LICENSE](https://github.com/bowo-prasetyo/equvolve/blob/main/LICENSE).

## Dibantu oleh

[ChatGPT](https://chatgpt.com/) dan [Claude Code](https://claude.com/claude-code).
