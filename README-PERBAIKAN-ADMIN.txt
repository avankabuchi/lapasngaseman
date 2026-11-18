PEMBARUAN CMS ADMIN — FOTO BERITA OTOMATIS DARI SUMBER
LAPAS KELAS IIA NGASEMAN

ISI PAKET
- index.html             Website publik; menampilkan imageUrl dari data berita.
- admin.html             CMS admin dengan UI yang disederhanakan dan pengelolaan foto via URL.
- api/extract-image.js   Vercel Serverless Function untuk membaca metadata foto utama artikel.
- firebase-client.js     Inisialisasi Firebase.
- firebase-config.js     Konfigurasi project Firebase.
- firestore.rules        Aturan akses Firestore.
- storage.rules          Aturan Storage lama; dipertahankan untuk foto berita yang sudah pernah diunggah.

PERUBAHAN UTAMA
1. Form berita tidak lagi mengharuskan admin memilih atau mengunggah file foto.
2. Admin memasukkan URL artikel pada kolom URL sumber berita, lalu memilih “Ambil Foto Otomatis dari Sumber”.
3. Endpoint /api/extract-image membaca metadata Open Graph/Twitter (misalnya og:image) dari halaman artikel dan mengembalikan URL gambar.
4. Admin dapat memeriksa pratinjau dan mengubah URL foto secara manual bila diperlukan.
5. Foto ditampilkan langsung dari server sumber; file gambar baru tidak dikirim atau disimpan ke Firebase Storage.
6. Data berita tetap disimpan ke Firestore seperti sebelumnya, dengan imageUrl dan imagePath kosong untuk berita baru.
7. Foto lama yang masih tersimpan di Firebase Storage tetap dapat ditampilkan. Saat berita lama diedit dan foto diganti, file lama akan dihapus setelah data Firestore berhasil diperbarui.

CARA MEMASANG (VERCEL)
1. Backup project website yang aktif.
2. Unggah/ganti index.html, admin.html, firebase-client.js, firebase-config.js, firestore.rules, dan storage.rules di root project.
3. Buat folder api di root project dan letakkan extract-image.js di dalamnya sehingga path menjadi api/extract-image.js.
4. Pastikan project dideploy melalui Vercel. Endpoint otomatis tersedia di /api/extract-image.
5. Deploy ulang website.
6. Buka /admin.html, login, lalu coba membuat berita dengan URL artikel yang dapat diakses publik.

CATATAN PENTING
- Fitur ekstraksi otomatis menggunakan Vercel Serverless Function. Jika website tidak di-host di Vercel atau hosting tidak mendukung folder /api sebagai function, endpoint perlu disesuaikan dengan hosting tersebut.
- Tidak semua situs berita mengizinkan halaman artikelnya dibaca oleh server lain atau mengisi metadata og:image/twitter:image. Jika ekstraksi gagal, salin alamat gambar langsung dari situs sumber lalu tempel ke kolom “URL foto (bisa diedit manual)”.
- Gambar ditampilkan langsung dari server sumber. Jika sumber menghapus/mengubah foto, memblokir hotlink, atau alamat gambar kedaluwarsa, foto di website dapat tidak tampil. Untuk kebutuhan arsip jangka panjang, simpan salinan hanya jika izin/hak penggunaan mengizinkan.
- Penggunaan foto pihak ketiga harus mengikuti hak cipta, lisensi, dan ketentuan situs sumber. Kolom kredit foto dapat diisi sebagai atribusi, tetapi atribusi tidak menggantikan izin penggunaan.
- Endpoint hanya mengambil metadata HTML, bukan mengunduh/menyalin file gambar. URL sumber dan URL gambar dibatasi ke HTTP/HTTPS publik; alamat localhost/IP privat ditolak.
- Firebase Storage tidak diperlukan untuk mengunggah foto berita baru. Firebase Authentication dan Firestore tetap digunakan untuk login admin dan menyimpan data berita.
- Rules Firestore tetap harus dipublikasikan manual di Firebase Console bila ada perubahan. Rules Storage lama boleh tetap ada untuk mengelola file berita lama.
- Pengujian sintaks dilakukan lokal. Pengujian ekstraksi ke situs berita tertentu serta login/simpan Firestore produksi memerlukan deploy ke project Vercel/Firebase pemilik.
