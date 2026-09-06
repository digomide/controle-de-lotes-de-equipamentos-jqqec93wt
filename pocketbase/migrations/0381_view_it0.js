migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message') || ''
    let msg = ''
    try {
      const data = JSON.parse(raw)
      const it0 = data.itList_raw && data.itList_raw[0] ? data.itList_raw[0] : {}
      const det0 = data.itemDetails && data.itemDetails[0] ? data.itemDetails[0] : {}
      msg =
        'it0_id=' +
        (it0.item_id || it0.id) +
        ' | it0_sold=' +
        it0.sold_quantity +
        ' | det0=' +
        JSON.stringify(det0)
    } catch (e) {
      msg = 'parse_err: ' + String(e) + ' | len=' + raw.length
    }
    job.set('seller_nickname', msg.substring(0, 250))
    app.save(job)
  },
  (app) => {},
)
