<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Preview lampiran</title>
</head>
<body>
    <main>
        <h1>{{ $attachment->name }}</h1>
        <p>Preview tidak tersedia untuk format file ini. Unduh file untuk membukanya dengan aplikasi yang sesuai.</p>
        <a href="{{ $downloadUrl }}" download>Download {{ $attachment->name }}</a>
    </main>
</body>
</html>
