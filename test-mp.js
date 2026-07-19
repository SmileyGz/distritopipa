const { MercadoPagoConfig, Preference } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });
const preference = new Preference(client);

async function test() {
  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: 'test-uuid-1234',
            title: 'Anticipo de Orden - Distrito Pipa',
            quantity: 1,
            unit_price: 50,
            currency_id: 'MXN'
          }
        ],
        back_urls: {
          success: 'https://www.distritopipa.com/checkout/success',
          failure: 'https://www.distritopipa.com/checkout/success',
          pending: 'https://www.distritopipa.com/checkout/success'
        },
        auto_return: 'approved',
        external_reference: 'test-uuid-1234',
      }
    });
    console.log(result.init_point);
  } catch (error) {
    console.error(error);
  }
}
test();
