# Capítulo 6: Sensibilidade e Otimização de Preços e Promoções

> "A precificação é a alavanca financeira mais sensível e veloz de qualquer modelo de negócios. Modificar o preço altera instantaneamente a margem de contribuição sem que seja necessário despender um único centavo adicional em custos fixos ou infraestrutura operacional. No entanto, quando operada sem modelos formais de demanda e sensibilidade, a formação de preços transforma-se na via mais rápida para a erosão de lucros e destruição de valor de mercado."
> — Clóvis Paulo Silva Filho

A determinação de preços é frequentemente tratada nas empresas como uma arte obscura ou um exercício contábil simplista de custo acrescido (*cost-plus*). Organizações adicionam uma margem arbitrária sobre os custos operacionais apurados e assumem que o mercado absorverá o volume planejado. Na outra ponta do espectro, equipes comerciais pressionadas por metas de curto prazo recorrem a concessões tarifárias contínuas, promoções desestruturadas e descontos generalizados na ilusão de que o aumento no volume de vendas compensará qualquer sacrifício de margem unitária.

Ambas as abordagens ignoram o princípio econômico fundamental que rege as transações comerciais: o comportamento da demanda em função da percepção de valor e da sensibilidade marginal do consumidor. 

Para estruturar decisões de precificação com rigor matemático e visão estratégica, é indispensável dominar a arquitetura das curvas de demanda lineares, deduzir os parâmetros estruturais do mercado — como o Preço Máximo de Reserva (PMR) e a Quantidade Máxima Desejada (QMD) —, quantificar os diferentes tipos de elasticidade-preço e desmembrar os mecanismos financeiros de promoções temporárias, cupons e repasses de canal.



<figure class="editorial-image">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="720" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>

  <!-- Wrapped Title & Subtitle Banner -->
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="1120" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', 'Garamond', serif;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #0f172a; line-height: 1.2; word-wrap: break-word; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          Arquitetura Analítica de Decisão e Otimização de P
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
          Fluxo contínuo desde a captura da sensibilidade do cliente até o ajuste fino da margem e governança de promoções comerciais.
        </p>
      </div>
    </foreignObject>
    <line x1="0" y1="85" x2="1120" y2="85" stroke="#0f172a" stroke-width="2"/>
  </g>

  <!-- Graphic Elements -->
  
          <g transform="translate(40, 140)">
            <!-- Card Container -->
            <rect width="253" height="480" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Step Badge Header -->
            <rect x="16" y="16" width="80" height="26" rx="6" fill="#0f172a" />
            <text x="56" y="33" font-family="'Georgia', serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ETAPA 1</text>
            
            <!-- Label -->
            <foreignObject x="16" y="54" width="221" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                1. Mapeamento de Reserva
              </div>
            </foreignObject>
            
            <line x1="16" y1="125" x2="237" y2="125" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Body -->
            <foreignObject x="16" y="138" width="221" height="325">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Identificação do Preço Máximo de Reserva (PMR) e da Quantidade Máxima Desejada (QMD) por segmento.
              </div>
            </foreignObject>
            
            
              <!-- D3 Connecting Arrow to Next Step -->
              <g transform="translate(261, 228)">
                <circle cx="10" cy="12" r="14" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.5"/>
                <path d="M 6 12 L 14 12 M 11 8 L 15 12 L 11 16" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
            
          </g>
        

          <g transform="translate(329, 140)">
            <!-- Card Container -->
            <rect width="253" height="480" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Step Badge Header -->
            <rect x="16" y="16" width="80" height="26" rx="6" fill="#059669" />
            <text x="56" y="33" font-family="'Georgia', serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ETAPA 2</text>
            
            <!-- Label -->
            <foreignObject x="16" y="54" width="221" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                2. Modelagem da Demanda
              </div>
            </foreignObject>
            
            <line x1="16" y1="125" x2="237" y2="125" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Body -->
            <foreignObject x="16" y="138" width="221" height="325">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Dedução da função de demanda linear e cálculo da elasticidade-preço pontual e contínua.
              </div>
            </foreignObject>
            
            
              <!-- D3 Connecting Arrow to Next Step -->
              <g transform="translate(261, 228)">
                <circle cx="10" cy="12" r="14" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.5"/>
                <path d="M 6 12 L 14 12 M 11 8 L 15 12 L 11 16" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
            
          </g>
        

          <g transform="translate(618, 140)">
            <!-- Card Container -->
            <rect width="253" height="480" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Step Badge Header -->
            <rect x="16" y="16" width="80" height="26" rx="6" fill="#2563eb" />
            <text x="56" y="33" font-family="'Georgia', serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ETAPA 3</text>
            
            <!-- Label -->
            <foreignObject x="16" y="54" width="221" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                3. Otimização de Preço e Margem
              </div>
            </foreignObject>
            
            <line x1="16" y1="125" x2="237" y2="125" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Body -->
            <foreignObject x="16" y="138" width="221" height="325">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Calibração do preço ótimo no ponto em que a margem de contribuição atinge o inverso negativo da elasticidade.
              </div>
            </foreignObject>
            
            
              <!-- D3 Connecting Arrow to Next Step -->
              <g transform="translate(261, 228)">
                <circle cx="10" cy="12" r="14" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1.5"/>
                <path d="M 6 12 L 14 12 M 11 8 L 15 12 L 11 16" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
            
          </g>
        

          <g transform="translate(907, 140)">
            <!-- Card Container -->
            <rect width="253" height="480" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Step Badge Header -->
            <rect x="16" y="16" width="80" height="26" rx="6" fill="#7c3aed" />
            <text x="56" y="33" font-family="'Georgia', serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ETAPA 4</text>
            
            <!-- Label -->
            <foreignObject x="16" y="54" width="221" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                4. Avaliação Promocional e Repasse
              </div>
            </foreignObject>
            
            <line x1="16" y1="125" x2="237" y2="125" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Body -->
            <foreignObject x="16" y="138" width="221" height="325">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Separação de vendas básicas versus incrementais, controle de quebra (breakage) e proteção contra o dilema do prisioneiro.
              </div>
            </foreignObject>
            
            
          </g>
        

  <!-- Footer Watermark -->
  <g transform="translate(40, 700)">
    <text x="0" y="0" font-family="'Georgia', serif" font-size="11" fill="#94a3b8" font-weight="600" letter-spacing="0.5">
      FIGURA EXPLICATIVA DE ALTA RESOLUÇÃO · EDIÇÃO EDITORIAL
    </text>
  </g>
</svg>
  <figcaption>Fluxo contínuo desde a captura da sensibilidade do cliente até o ajuste fino da margem e governança de promoções comerciais.</figcaption>
</figure>





## 1. Fundamentos da Curva de Demanda Linear e Microeconomia Aplicada

Toda estratégia comercial de sucesso apoia-se em um modelo subjacente de como o mercado reage a variações no preço. A representação mais robusta e operacional para a tomada de decisão gerencial é a função de demanda linear. 

Embora o comportamento agregado de mercados complexos possa exibir não linearidades em faixas extremas, a curva linear fornece uma aproximação de alta precisão dentro do intervalo relevante de operação (*relevant range*) em que as empresas tomam decisões de precificação no dia a dia.

### Preço de Reserva e Porcentagem de Bom Preço

Para compreender a formação de uma curva de demanda a partir de primeiros princípios, é necessário examinar as decisões individuais de compra.

O **Preço de Reserva** é o valor monetário máximo que um consumidor individual está disposto a pagar por uma unidade de um produto ou serviço. Esse valor reflete o teto da percepção de valor daquele indivíduo, considerando suas restrições orçamentárias, necessidades específicas e produtos substitutos disponíveis no mercado. Se o preço cobrado for estritamente superior ao preço de reserva do cliente, a transação não ocorre. Se o preço for inferior ou igual, a compra é concretizada, gerando o chamado "excedente do consumidor".

Como os preços de reserva individuais variam amplamente em uma população e são de difícil observação direta sem pesquisas de sensibilidade aprofundadas, os gestores utilizam a métrica de **Porcentagem de Bom Preço** (*Percentage of Good Value*). Essa métrica representa a proporção da base total de clientes potenciais que considera que o produto apresenta um preço atrativo — isto é, cujo preço cobrado está posicionado abaixo de seus respectivos preços de reserva. 

À medida que a empresa reduz o preço de venda, uma parcela progressivamente maior da população considera o produto um "bom negócio", expandindo a penetração de mercado. A agregação dessas respostas individuais ao longo de múltiplos níveis de preços dá origem à função de demanda do mercado.



## 2. Dedução Matemática da Curva de Demanda: PMR e QMD

A curva de demanda linear é descrita formalmente pela relação entre a quantidade demandada (Q) e o preço praticado (P). Dois parâmetros fundamentais ancoram essa relação:

1. **Preço Máximo de Reserva (PMR):** É a interceptação da curva no eixo vertical dos preços. Representa o preço teórico no qual a demanda cai exatamente a zero. Acima desse valor, nenhum consumidor no mercado está disposto a adquirir o produto.
2. **Quantidade Máxima Desejada (QMD):** É a interceptação da curva no eixo horizontal da quantidade. Representa a quantidade total que o mercado absorveria se o produto fosse distribuído a um preço igual a zero (gratuito). Reflete a saturação física ou estrutural do mercado sob custo monetário nulo.

A equação canônica da demanda linear expressa a quantidade demandada em função do preço:

Quantidade Demandada = Quantidade Máxima Desejada multiplicado por (1 menos (Preço cobrado dividido pelo Preço Máximo de Reserva))

Ou, de forma simplificada:

Q = QMD * (1 - (P / PMR))



<figure class="editorial-image">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="720" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>

  <!-- Wrapped Title & Subtitle Banner -->
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="1120" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', 'Garamond', serif;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #0f172a; line-height: 1.2; word-wrap: break-word; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          Pilares Estruturais da Curva de Demanda Linear
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
          Os três parâmetros essenciais que definem a dinâmica de volume, receita e margem na modelagem linear.
        </p>
      </div>
    </foreignObject>
    <line x1="0" y1="85" x2="1120" y2="85" stroke="#0f172a" stroke-width="2"/>
  </g>

  <!-- Graphic Elements -->
  
          <g transform="translate(40, 140)">
            <!-- Card Base -->
            <rect width="360" height="500" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Header Stripe -->
            <path d="M 0 10 Q 0 0 10 0 L 350 0 Q 360 0 360 10 L 360 38 L 0 38 Z" fill="#0f172a" />
            <text x="16" y="24" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">PILAR 1</text>
            
            <!-- Dynamic Wrapped Title -->
            <foreignObject x="16" y="50" width="328" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
                PMR (Preço Máximo de Reserva)
              </div>
            </foreignObject>
            
            <!-- Divider -->
            <line x1="16" y1="120" x2="344" y2="120" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Block -->
            <foreignObject x="16" y="130" width="328" height="355">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Teto teórico de preço no qual a quantidade demandada se anula por completo (Q = 0).
              </div>
            </foreignObject>
          </g>
        

          <g transform="translate(420, 140)">
            <!-- Card Base -->
            <rect width="360" height="500" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Header Stripe -->
            <path d="M 0 10 Q 0 0 10 0 L 350 0 Q 360 0 360 10 L 360 38 L 0 38 Z" fill="#059669" />
            <text x="16" y="24" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">PILAR 2</text>
            
            <!-- Dynamic Wrapped Title -->
            <foreignObject x="16" y="50" width="328" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
                QMD (Quantidade Máxima Desejada)
              </div>
            </foreignObject>
            
            <!-- Divider -->
            <line x1="16" y1="120" x2="344" y2="120" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Block -->
            <foreignObject x="16" y="130" width="328" height="355">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Volume máximo absorvido pelo mercado caso o produto seja ofertado a custo zero (P = 0).
              </div>
            </foreignObject>
          </g>
        

          <g transform="translate(800, 140)">
            <!-- Card Base -->
            <rect width="360" height="500" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
            
            <!-- Header Stripe -->
            <path d="M 0 10 Q 0 0 10 0 L 350 0 Q 360 0 360 10 L 360 38 L 0 38 Z" fill="#2563eb" />
            <text x="16" y="24" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">PILAR 3</text>
            
            <!-- Dynamic Wrapped Title -->
            <foreignObject x="16" y="50" width="328" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
                Inclinação da Demanda
              </div>
            </foreignObject>
            
            <!-- Divider -->
            <line x1="16" y1="120" x2="344" y2="120" stroke="#e2e8f0" stroke-width="1"/>
            
            <!-- Description Block -->
            <foreignObject x="16" y="130" width="328" height="355">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: #475569; text-align: left; word-wrap: break-word; overflow: hidden;">
                Taxa constante de variação que determina quantas unidades de volume são perdidas a cada unidade monetária de aumento no preço.
              </div>
            </foreignObject>
          </g>
        

  <!-- Footer Watermark -->
  <g transform="translate(40, 700)">
    <text x="0" y="0" font-family="'Georgia', serif" font-size="11" fill="#94a3b8" font-weight="600" letter-spacing="0.5">
      FIGURA EXPLICATIVA DE ALTA RESOLUÇÃO · EDIÇÃO EDITORIAL
    </text>
  </g>
</svg>
  <figcaption>Os três parâmetros essenciais que definem a dinâmica de volume, receita e margem na modelagem linear.</figcaption>
</figure>



### Determinação de PMR e QMD a partir de Dois Pontos Observáveis

Na prática gerencial, as empresas raramente conhecem de antemão o PMR e a QMD teóricos do mercado. Entretanto, elas dispõem de dados históricos de vendas ou de testes controlados de preços em que observaram determinados volumes de venda sob preços distintos. 

Se a demanda se comportar de forma linear no intervalo observado, quaisquer dois pares de preço e quantidade observados — designados como (P1, Q1) e (P2, Q2) — são suficientes para deduzir com precisão absoluta o PMR e a QMD do segmento.

A dedução matemática parte da inclinação linear constante da reta (delta Q dividido por delta P):


> **Fórmula / Relação Analítica:**  
> *Inclinação = (Q2 - Q1) / (P2 - P1)*


A partir da equação linear ponto-declive, deduzem-se as fórmulas diretas para os interceptos:

Quantidade Máxima Desejada:

> **Fórmula / Relação Analítica:**  
> *QMD = Q1 - ((Q2 - Q1) / (P2 - P1)) * P1*


Preço Máximo de Reserva:

> **Fórmula / Relação Analítica:**  
> *PMR = P1 - ((P2 - P1) / (Q2 - Q1)) * Q1*


#### Exemplo Prático de Dedução

Considere uma empresa que comercializa um produto industrial especializado. Em um primeiro ciclo de vendas, ao praticar o preço unitário de P1 = R90,00, a empresa registrou um volume de vendas de Q1 = 5 unidades. Em um ciclo subsequente, ao testar o preço de P2 = R 110,00, as vendas recuaram para Q2 = 3 unidades.

Assumindo que as condições de mercado permaneceram estáveis e que a demanda segue um padrão linear no intervalo:


> **Fórmula / Relação Analítica:**  
> *1. Variação no preço (P2 - P1) = R110,00 - R 90,00 = R$ 20,00*


> **Fórmula / Relação Analítica:**  
> *2. Variação na quantidade (Q2 - Q1) = 3 - 5 = -2 unidades*


Aplicando as equações de dedução:

QMD = 5 - ((-2 / 20) * 90)
QMD = 5 - (-0,1 * 90)
QMD = 5 - (-9) = 14 unidades

PMR = 90 - ((20 / -2) * 5)
PMR = 90 - (-10 * 5)
PMR = 90 - (-50) = R$ 140,00

A função de demanda específica para essa linha de produtos é expressa como:

Q = 14 * (1 - (P / 140))

Testando a consistência do modelo:

> **Fórmula / Relação Analítica:**  
> *- Se o preço for fixado em R$ 90,00: Q = 14 * (1 - 90/140) = 14 * (1 - 0,642857) = 14 * 0,357143 = 5 unidades.*


> **Fórmula / Relação Analítica:**  
> *- Se o preço for fixado em R$ 110,00: Q = 14 * (1 - 110/140) = 14 * (1 - 0,785714) = 14 * 0,214286 = 3 unidades.*


> **Fórmula / Relação Analítica:**  
> *- Se o preço for elevado a R$ 140,00: Q = 14 * (1 - 140/140) = 0 unidades (atingimento do PMR).*


> **Fórmula / Relação Analítica:**  
> *- Se o produto fosse ofertado a R$ 0,00: Q = 14 * (1 - 0) = 14 unidades (atingimento da QMD).*


Essa formalização fornece à gestão a capacidade de projetar a quantidade demandada para qualquer faixa de preço intermediária (por exemplo, a um preço de R$ 100,00, a demanda projetada é de 4 unidades).



## 3. Otimização de Preço e Segmentação de Valor

Uma vez estabelecida a função de demanda e conhecidos os custos variáveis unitários de produção e entrega do produto (CV), o objetivo financeiro consiste em identificar o **Preço Ótimo (P\*)** — o preço exato que maximiza a Contribuição Marginal Total da empresa.

Para uma função de demanda linear simples com custo variável unitário constante, o preço ótimo que maximiza o lucro é exatamente o ponto médio entre o Preço Máximo de Reserva (PMR) e o Custo Variável Unitário (CV):


> **Fórmula / Relação Analítica:**  
> *Preço Ótimo = (Preço Máximo de Reserva + Custo Variável Unitário) / 2*


P\* = (PMR + CV) / 2

A quantidade demandada ótima (Q\*) resultante desse preço ótimo corresponde a:


> **Fórmula / Relação Analítica:**  
> *Q\* = QMD * (1 - (P\* / PMR)) = (QMD / PMR) * (PMR - P\*)*


E a Contribuição Marginal Total Máxima gerada é calculada por:


> **Fórmula / Relação Analítica:**  
> *Contribuição Marginal Total\* = Q\* * (P\* - CV) = (QMD / PMR) * ((PMR - CV) / 2) elevado ao quadrado*


### Preço Único versus Discriminação de Preços por Segmento

Mercados raramente são homogêneos. Frequentemente, a base de clientes é composta por múltiplos segmentos com disposições a pagar marcadamente distintas. 

Considere um mercado dividido em dois grupos claros de clientes:

> **Fórmula / Relação Analítica:**  
> *1. **Segmento Focado em Estilo / Marca:** Menos sensível ao preço, com alto preço de reserva (PMR = R$ 30,00) e demanda máxima de 10 unidades (QMD = 10).*


> **Fórmula / Relação Analítica:**  
> *2. **Segmento Focado em Valor / Economia:** Altamente sensível ao preço, com menor disposição a pagar (PMR = R$ 10,00) e demanda máxima volumétrica de 40 unidades (QMD = 40).*


Assuma que o custo variável unitário para fabricar o produto seja de CV = R$ 2,00 para ambos os segmentos.

| Estratégia de Precificação | Preço Praticado (R) | Quantidade Estilo (un.) | Quantidade Valor (un.) | Volume Total (un.) | Receita Bruta (R) | Contribuição Total (R$) |
| :

> **Fórmula / Relação Analítica:**  
> *Se a empresa for obrigada a operar com um **preço único uniforme**, o ponto ótimo de maximização global ocorre em P = R6,77, gerando uma contribuição marginal combinada de R 98,56.*


Entretanto, se a empresa adotar uma estratégia de **precificação segmentada** (por exemplo, criando uma versão *premium* sob uma marca dedicada para o segmento de Estilo e uma versão essencial para o segmento de Valor), os preços ótimos independentes são calculados separadamente:

- **Segmento Estilo:**

> **Fórmula / Relação Analítica:**  
> *P\* = (PMR + CV) / 2 = (30 + 2) / 2 = R$ 16,00*


> **Fórmula / Relação Analítica:**  
> *Q\* = 10 * (1 - 16/30) = 4,67 unidades*


> **Fórmula / Relação Analítica:**  
> *Contribuição = 4,67 * (16,00 - 2,00) = R$ 65,33*


- **Segmento Valor:**

> **Fórmula / Relação Analítica:**  
> *P\* = (PMR + CV) / 2 = (10 + 2) / 2 = R$ 6,00*


> **Fórmula / Relação Analítica:**  
> *Q\* = 40 * (1 - 6/10) = 16,00 unidades*


> **Fórmula / Relação Analítica:**  
> *Contribuição = 16,00 * (6,00 - 2,00) = R$ 64,00*


Ao adaptar a precificação às curvas de demanda individuais, o volume total atinge 20,67 unidades, a receita bruta alcança R170,67 e a **contribuição marginal total salta para R 129,33** — um incremento de lucratividade de 31,2% em relação ao melhor preço único possível, sem qualquer alteração na estrutura de custos fabris.



## 4. Elasticidade-Preço da Demanda: Mecânica, Tipologias e Otimização

A **Elasticidade-Preço da Demanda (E)** quantifica a sensibilidade percentual do volume demandado frente a uma variação percentual no preço:


> **Fórmula / Relação Analítica:**  
> *Elasticidade da Demanda = Variação Percentual na Quantidade Demandada / Variação Percentual no Preço*


Como a quantidade demandada e o preço quase invariavelmente variam em direções opostas (aumentos de preço reduzem o volume), a elasticidade-preço assume valor negativo. Na literatura e no jargão financeiro, é comum referir-se à elasticidade em termos de seu valor absoluto ou com o sinal negativo explícito:

- **Demanda Elástica (|E| > 1):** A variação percentual na quantidade é maior do que a variação no preço. Reduções no preço aumentam a receita bruta total; elevações de preço contraem a receita bruta.

> **Fórmula / Relação Analítica:**  
> *- **Elasticidade Unitária (|E| = 1):** A variação percentual no volume é idêntica à variação no preço. A receita bruta atinge seu ponto máximo teórico.*

- **Demanda Inelástica (|E| < 1):** A variação percentual no volume é menor do que a variação percentual no preço. Aumentos de preço aumentam a receita bruta total; cortes de preço reduzem a receita.



<figure class="editorial-image">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="720" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>

  <!-- Wrapped Title & Subtitle Banner -->
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="1120" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', 'Garamond', serif;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #0f172a; line-height: 1.2; word-wrap: break-word; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          Regimes de Elasticidade-Preço e Impacto na Receita
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
          Como a variação de preços impacta o faturamento bruto em diferentes zonas de elasticidade.
        </p>
      </div>
    </foreignObject>
    <line x1="0" y1="85" x2="1120" y2="85" stroke="#0f172a" stroke-width="2"/>
  </g>

  <!-- Graphic Elements -->
  
      <g transform="translate(40, 140)">
        <!-- Table Header -->
        <rect width="1120" height="45" rx="8" fill="#0f172a" />
        <text x="24" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DIMENSÃO / ETAPA OPERACIONAL</text>
        <text x="420" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DESDOBRAMENTO ESTRATÉGICO & DIRETRIZ</text>
        
        <!-- Rows -->
        
            <g transform="translate(0, 55)">
              <rect width="1120" height="62" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#0f172a"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Demanda Inelástica (|E| &lt; 1)
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Elevação de Preço: Aumenta a Receita Bruta. Redução de Preço: Reduz a Receita Bruta.
                </div>
              </foreignObject>
            </g>
          

            <g transform="translate(0, 125)">
              <rect width="1120" height="62" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#059669"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Elasticidade Unitária (|E| = 1)
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Elevação ou Redução: Receita Bruta permanece neutra (ponto de máximo faturamento).
                </div>
              </foreignObject>
            </g>
          

            <g transform="translate(0, 195)">
              <rect width="1120" height="62" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#2563eb"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Demanda Elástica (|E| &gt; 1)
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Elevação de Preço: Reduz a Receita Bruta. Redução de Preço: Aumenta a Receita Bruta.
                </div>
              </foreignObject>
            </g>
          
      </g>
    

  <!-- Footer Watermark -->
  <g transform="translate(40, 700)">
    <text x="0" y="0" font-family="'Georgia', serif" font-size="11" fill="#94a3b8" font-weight="600" letter-spacing="0.5">
      FIGURA EXPLICATIVA DE ALTA RESOLUÇÃO · EDIÇÃO EDITORIAL
    </text>
  </g>
</svg>
  <figcaption>Como a variação de preços impacta o faturamento bruto em diferentes zonas de elasticidade.</figcaption>
</figure>



### Elasticidade Linear versus Demanda de Elasticidade Constante

Um erro gerencial comum é presumir que a elasticidade de um produto é um número fixo e imutável.

1. **Na Demanda Linear:** A inclinação da reta (variação absoluta de Q dividida pela variação absoluta de P) é constante em toda a sua extensão, mas a **elasticidade varia em cada ponto da curva**. No ponto de preço igual ao PMR, a elasticidade tende ao infinito negativo. No ponto médio da curva de demanda (onde o faturamento é máximo), a elasticidade é exatamente igual a -1. Abaixo do ponto médio, aproximando-se do preço zero, a elasticidade aproxima-se de zero (região inelástica).
2. **Na Demanda de Elasticidade Constante (Função Potência):** A elasticidade permanece rigorosamente a mesma em todos os níveis de preço, o que implica que a inclinação absoluta da curva torna-se cada vez mais íngreme à medida que o preço sobe.

### A Regra Fundamental da Margem Ótima

A conexão direta entre a microeconomia da elasticidade e as finanças corporativas é dada pelo teorema do preço ótimo. 

Para qualquer empresa maximizadora de lucro com custo marginal constante, o **preço ótimo é alcançado quando a Margem de Contribuição Percentual da empresa é igual ao inverso negativo da elasticidade-preço da demanda**:


> **Fórmula / Relação Analítica:**  
> *Margem de Contribuição Ótima (%) = -1 / Elasticidade-Preço da Demanda*


Onde:


> **Fórmula / Relação Analítica:**  
> *Margem de Contribuição Percentual = (Preço - Custo Variável Unitário) / Preço*



> **Fórmula / Relação Analítica:**  
> *Se a elasticidade-preço estimada de um produto for E = -2,5, a margem de contribuição percentual ótima que a empresa deve aplicar sobre o preço é:*



> **Fórmula / Relação Analítica:**  
> *Margem Ótima = -1 / (-2,5) = 1 / 2,5 = 0,40 (ou 40%)*


Se a margem atual estiver em 25%, a empresa está cobrando um preço inferior ao ótimo (subprecificando); se a margem estiver em 55%, a empresa está na zona superprecificada, sacrificando volume excessivo.

### Elasticidade Própria, Cruzada e Residual

As análises de precificação tornam-se incompletas se ignorarem o ambiente competitivo dinâmico:

- **Elasticidade Própria (*Own-Price Elasticity*):** Mede a variação percentual na demanda do produto A decorrente exclusivamente da alteração no preço do próprio produto A, mantendo os preços da concorrência inalterados (*ceteris paribus*).
- **Elasticidade Cruzada (*Cross-Price Elasticity*):** Mede a variação percentual na demanda do produto A em resposta a uma variação percentual no preço de um produto concorrente B:

> **Fórmula / Relação Analítica:**  
> *Elasticidade Cruzada = (% Variação na Quantidade de A) / (% Variação no Preço de B)*

  Se a elasticidade cruzada for positiva, os produtos são **substitutos** (o aumento do preço do concorrente expande as vendas da sua empresa). Se for negativa, são produtos **complementares**.
- **Elasticidade Residual (*Residual Elasticity*):** É a elasticidade líquida que a empresa efetivamente experimenta no mundo real após os concorrentes reagirem à sua mudança de preço. Se uma marca reduz seu preço em 10% esperando uma expansão de volume de 25% (elasticidade própria de -2,5), mas os principais concorrentes retaliam imediatamente com reduções idênticas de 10%, o ganho líquido de volume será limitado apenas à expansão da categoria como um todo, resultando em uma elasticidade residual muito menor (por exemplo, -0,5). A empresa sofre uma contração generalizada de margem sem capturar a fatia de mercado pretendida.



## 5. Promoções Comerciais, Cupons e a Mecânica do Repasse (*Pass-Through*)

As reduções de preços podem ser estruturais e permanentes ou temporárias e promocionais. Enquanto ajustes estruturais redefinem o posicionamento de mercado, promoções temporárias têm como propósito induzir comportamentos imediatos: incentivar a experimentação por não clientes, atrair compradores sensíveis a custo, defender espaço em gôndola e estimular o estoque preventivo do canal.

No entanto, promoções comerciais temporárias representam uma das maiores fontes de desperdício de capital de marketing quando não monitoradas por métricas de decomposição de vendas e lucratividade incremental.

### Vendas Básicas versus Vendas Incrementais

A avaliação financeira de qualquer ação promocional exige a separação rigorosa entre dois blocos volumétricos:

1. **Vendas Básicas (*Baseline Sales*):** Representam o volume de vendas que a empresa realizaria naturalmente no período regular de operação sem a concessão de qualquer desconto, promoção ou incentivo extraordinário. As vendas básicas decorrem da força da marca, distribuição estabelecida e demanda orgânica estável.
2. **Vendas Incrementais (*Incremental Sales* ou *Promotional Lift*):** Representam o volume adicional de produtos vendido estritamente em função da ativação promocional:


> **Fórmula / Relação Analítica:**  
> *Vendas Incrementais = Vendas Totais Registradas - Vendas Básicas Estimadas*




<figure class="editorial-image">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="1200" height="720" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>

  <!-- Wrapped Title & Subtitle Banner -->
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="1120" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', 'Garamond', serif;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #0f172a; line-height: 1.2; word-wrap: break-word; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          Decomposição Financeira do Volume Promocional
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
          Fluxo de alocação de volume entre demanda orgânica pré-existente e ganhos reais gerados pela promoção.
        </p>
      </div>
    </foreignObject>
    <line x1="0" y1="85" x2="1120" y2="85" stroke="#0f172a" stroke-width="2"/>
  </g>

  <!-- Graphic Elements -->
  
      <g transform="translate(40, 140)">
        <!-- Table Header -->
        <rect width="1120" height="45" rx="8" fill="#0f172a" />
        <text x="24" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DIMENSÃO / ETAPA OPERACIONAL</text>
        <text x="420" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DESDOBRAMENTO ESTRATÉGICO & DIRETRIZ</text>
        
        <!-- Rows -->
        
            <g transform="translate(0, 55)">
              <rect width="1120" height="62" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#0f172a"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Vendas Totais do Período
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Volume global de transações registradas durante a janela de vigência da campanha promocional.
                </div>
              </foreignObject>
            </g>
          

            <g transform="translate(0, 125)">
              <rect width="1120" height="62" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#059669"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Subtração: Vendas Básicas (Baseline)
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Volume que teria sido vendido ao preço regular mesmo sem a concessão de desconto.
                </div>
              </foreignObject>
            </g>
          

            <g transform="translate(0, 195)">
              <rect width="1120" height="62" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="62" rx="3" fill="#2563eb"/>
              <foreignObject x="20" y="8" width="380" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: #0f172a; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  Resultado: Vendas Incrementais (Lift)
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="680" height="46">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: #475569; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  Volume gerado exclusivamente pelo estímulo promocional, que deve remunerar o custo total da campanha.
                </div>
              </foreignObject>
            </g>
          
      </g>
    

  <!-- Footer Watermark -->
  <g transform="translate(40, 700)">
    <text x="0" y="0" font-family="'Georgia', serif" font-size="11" fill="#94a3b8" font-weight="600" letter-spacing="0.5">
      FIGURA EXPLICATIVA DE ALTA RESOLUÇÃO · EDIÇÃO EDITORIAL
    </text>
  </g>
</svg>
  <figcaption>Fluxo de alocação de volume entre demanda orgânica pré-existente e ganhos reais gerados pela promoção.</figcaption>
</figure>



O erro financeiro mais comum consiste em calcular o retorno de uma promoção aplicando a margem de contribuição sobre as **vendas totais** do período promocional. 

Se a empresa concede um desconto temporário de 15% e vende 10.000 unidades, mas suas vendas básicas seriam de 8.500 unidades a preço cheio, a promoção gerou apenas 1.500 unidades incrementais. Contudo, o desconto de 15% incidiu sobre a totalidade das 10.000 unidades comercializadas.

O ganho bruto obtido nas 1.500 unidades adicionais precisa ser suficiente para absorver o sacrifício de margem imposto sobre as 8.500 unidades que teriam sido compradas pelo preço regular. Se a margem incremental não compensar essa perda de receita básica, a promoção gera destruição líquida de valor.

### A Economia de Cupons, Reembolsos (*Rebates*) e a Taxa de Quebra (*Breakage*)

Cupons e programas de reembolso pós-venda (*mail-in rebates* ou *cashback*) são ferramentas de discriminação de preços temporária de segundo e terceiro graus. Elas permitem conceder um preço efetivo reduzido exclusivamente para o segmento de consumidores altamente sensíveis ao preço (aqueles dispostos a despender tempo coletando, armazenando e resgatando o benefício), enquanto os consumidores inelásticos continuam pagando o preço integral de tabela.

A estrutura de mensuração de cupons requer o acompanhamento de métricas financeiras precisas:

- **Taxa de Resgate (*Redemption Rate*):**

> **Fórmula / Relação Analítica:**  
> *Taxa de Resgate (%) = Cupons Resgatados / Cupons Distribuídos*


- **Taxa de Quebra (*Breakage Rate*):** Representa a proporção de incentivos ou descontos oferecidos que não chegam a ser resgatados pelo consumidor final devido ao esquecimento, perda de prazos ou atrito burocrático:

> **Fórmula / Relação Analítica:**  
> *Taxa de Quebra (%) = 1 - Taxa de Resgate*


- **Custo por Resgate Unitário:**

> **Fórmula / Relação Analítica:**  
> *Custo por Resgate Unitário = Valor Nominal do Desconto no Cupom + Taxa Operacional de Liquidação*


- **Custo Total do Programa de Cupons:**

> **Fórmula / Relação Analítica:**  
> *Custo Total = (Número de Cupons Resgatados * Custo por Resgate Unitário) + Custos Fixos de Impressão, Mídia e Distribuição*


- **Custo Total Efetivo por Resgate:**

> **Fórmula / Relação Analítica:**  
> *Custo Total por Resgate = Custo Total do Programa de Cupons / Número de Cupons Resgatados*


#### Exemplo Numérico de Economia de Cupons

Uma indústria de bens de consumo distribui 100.000 cupons promocionais com valor nominal de R5,00 de desconto por embalagem. A agência de compensação cobra uma taxa de liquidação de R 0,50 por cupom processado. Os custos fixos de criação, veiculação em mídia digital e distribuição somaram R$ 20.000,00. No fechamento da campanha, 8.000 cupons foram efetivamente resgatados no varejo.


> **Fórmula / Relação Analítica:**  
> *1. Taxa de Resgate = 8.000 / 100.000 = 8,0% (Taxa de Quebra = 92,0%)*


> **Fórmula / Relação Analítica:**  
> *2. Custo Unitário Variável por Resgate = R5,00 + R 0,50 = R$ 5,50*


> **Fórmula / Relação Analítica:**  
> *3. Custo Variável Total = 8.000 * R5,50 = R 44.000,00*


> **Fórmula / Relação Analítica:**  
> *4. Custo Total da Campanha = R44.000,00 + R 20.000,00 = R$ 64.000,00*


> **Fórmula / Relação Analítica:**  
> *5. Custo Total Efetivo por Resgate = R64.000,00 / 8.000 = R 8,00 por cupom utilizado*


Para que a campanha tenha viabilidade econômica, o lucro incremental gerado por cada consumidor atraído pelo cupom (considerando o valor de novos