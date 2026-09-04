migrate(
  (app) => {
    // 0028_restore_thinkpad_t580_photos.js
    // Reconstituir o array de fotos do Notebook Lenovo ThinkPad T580 (SKU R90S2BGP, ID 82b1k0m0l2hanr3).
    // O equipamento possuía 5 fotos originais enviadas em 01/09/2026 que permanecem íntegras no storage
    // do PocketBase, e que haviam sido temporariamente desvinculadas pelo bug do FormData.photos:
    // 1. whats_app_image_2026_09_01_at_17_29_wa4fcdzscx.28.jpeg
    // 2. whats_app_image_2026_09_01_at_17_29_2csufrxi9z.29.jpeg
    // 3. whats_app_image_2026_09_01_at_17_29_j3uucvavm1.281.jpeg
    // 4. whats_app_image_2026_09_01_at_17_29_8co503x9q2.283.jpeg
    // 5. whats_app_image_2026_09_01_at_17_29_lmrokaedvc.282.jpeg
    // Mais a foto processada com fundo branco pela IA:
    // notebook_ml_bg_white_1788559433211_vr3bhtsqt0.jpg
    try {
      const prod = app.findFirstRecordByData('products', 'sku', 'R90S2BGP')
      if (prod) {
        const fullPhotosList = [
          'notebook_ml_bg_white_1788559433211_vr3bhtsqt0.jpg',
          'whats_app_image_2026_09_01_at_17_29_wa4fcdzscx.28.jpeg',
          'whats_app_image_2026_09_01_at_17_29_2csufrxi9z.29.jpeg',
          'whats_app_image_2026_09_01_at_17_29_j3uucvavm1.281.jpeg',
          'whats_app_image_2026_09_01_at_17_29_8co503x9q2.283.jpeg',
          'whats_app_image_2026_09_01_at_17_29_lmrokaedvc.282.jpeg',
        ]
        prod.set('photos', fullPhotosList)
        app.save(prod)
      }
    } catch (err) {
      console.log('Erro ao restaurar fotos do T580: ' + err)
    }
  },
  (app) => {
    try {
      const prod = app.findFirstRecordByData('products', 'sku', 'R90S2BGP')
      if (prod) {
        prod.set('photos', ['notebook_ml_bg_white_1788559433211_vr3bhtsqt0.jpg'])
        app.save(prod)
      }
    } catch (_) {}
  },
)
