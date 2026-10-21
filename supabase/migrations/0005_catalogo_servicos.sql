-- =============================================================================
-- 0005 — Catálogo de serviços inicial
--
-- Os 19 serviços da planilha que o n8n lia pelo Google Sheets (ferramenta
-- `servicos_tool`), agora em `servicos_adv`. É ESTA lista que a secretária de
-- IA oferece e é dela que sai o nome gravado na consulta.
--
-- ⚠️ Ela é do escritório que originou o sistema (Direito de Família e
-- Sucessões). Um escritório novo revisa em Configurações → Serviços ANTES de
-- ligar a secretária: ela só oferece o que está ativo aqui.
-- =============================================================================

insert into public.servicos_adv (categoria, nome, descricao, ordem) values
  ('Casamento e relacionamento', 'Divórcio',
   'Conduzimos todo o processo de divórcio com orientação jurídica completa, garantindo que a separação ocorra de forma segura e dentro da lei. O divórcio pode ser consensual, quando há acordo entre as partes, ou litigioso, quando existem conflitos que precisam ser resolvidos judicialmente. Também auxiliamos na definição de questões como divisão de bens, guarda de filhos e pensão alimentícia. Cada situação é analisada com atenção para buscar a solução mais adequada. Nosso objetivo é conduzir o processo com clareza, segurança jurídica e agilidade, reduzindo desgastes e trazendo mais tranquilidade para esse momento.',
   1),
  ('Casamento e relacionamento', 'Separação de corpos',
   'A separação de corpos é uma medida judicial utilizada quando um casal precisa interromper a convivência imediatamente, mesmo antes da conclusão do divórcio. Esse procedimento garante proteção jurídica enquanto a situação conjugal é resolvida de forma definitiva. Pode ser necessário em casos de conflitos intensos, desgaste na relação ou situações que exigem o afastamento entre os cônjuges. A medida também ajuda a proteger direitos patrimoniais e evitar complicações legais durante esse período. Atuamos com orientação jurídica e condução do processo para garantir segurança às partes e preservar seus direitos até a finalização do divórcio.',
   2),
  ('Casamento e relacionamento', 'União estável',
   'Atuamos no reconhecimento ou na dissolução de união estável, garantindo que os direitos do casal sejam formalizados perante a lei. Muitas relações duradouras são consideradas juridicamente união estável, mesmo sem casamento oficial. Nesses casos, é importante regular questões como divisão de bens, responsabilidades e direitos patrimoniais. Também auxiliamos na formalização da união para trazer mais segurança jurídica ao relacionamento. Em situações de separação, conduzimos o processo de dissolução com definição de bens e responsabilidades, sempre buscando uma solução justa e clara para ambas as partes.',
   3),
  ('Filhos e família', 'Pensão alimentícia',
   'Atuamos na definição, revisão ou encerramento da pensão alimentícia, buscando equilíbrio entre as necessidades de quem recebe e as possibilidades de quem paga. A pensão é um direito destinado a garantir o sustento e o bem-estar de filhos ou dependentes. Cada caso é analisado considerando renda, despesas e a realidade financeira das partes. Também atuamos em pedidos de revisão quando há mudanças na situação financeira ou nas necessidades do beneficiário. O processo pode ocorrer por acordo entre as partes ou por via judicial, sempre garantindo uma solução justa e dentro da lei.',
   4),
  ('Filhos e família', 'Guarda de filhos',
   'Auxiliamos na definição da guarda dos filhos após a separação dos pais, sempre priorizando o bem-estar e o desenvolvimento da criança. A guarda pode ser compartilhada, quando ambos os pais participam das decisões importantes, ou unilateral, quando apenas um assume essa responsabilidade principal. Também ajudamos a organizar o regime de convivência e visitas. Cada caso é analisado considerando a realidade da família e o melhor interesse do menor. O objetivo é garantir estabilidade para a criança e segurança jurídica para todos os envolvidos.',
   5),
  ('Filhos e família', 'Adoção',
   'Acompanhamos todo o processo de adoção com orientação jurídica, garantindo que cada etapa seja realizada dentro das exigências legais. A adoção envolve critérios específicos e acompanhamento da justiça para assegurar o bem-estar da criança. Atuamos desde a orientação inicial até a conclusão do processo judicial. Também auxiliamos na preparação da documentação e no acompanhamento do procedimento. Nosso objetivo é garantir segurança jurídica para a criança e para a família adotante, conduzindo cada caso com responsabilidade e sensibilidade.',
   6),
  ('Filhos e família', 'Regulamentação de convivência familiar',
   'A regulamentação de convivência familiar define juridicamente como ocorrerá o contato entre filhos e familiares após uma separação ou conflito familiar. O processo estabelece regras sobre visitas, períodos de convivência e responsabilidades de cada parte. Pode envolver pais, avós ou outros parentes que possuem vínculo com a criança. Atuamos na construção de acordos ou na condução do processo judicial quando necessário. O objetivo é garantir relações familiares equilibradas e preservar o melhor interesse da criança.',
   7),
  ('Filhos e família', 'Investigação de paternidade',
   'Atuamos em processos de investigação de paternidade quando há dúvida ou necessidade de confirmar o vínculo biológico entre pai e filho. Esse tipo de ação busca garantir direitos como o reconhecimento legal e a inclusão do nome no registro civil. O processo pode envolver exames de DNA e análise de provas. Também atuamos em casos de contestação de paternidade quando há questionamentos sobre o vínculo existente. Nosso objetivo é esclarecer juridicamente a relação de filiação e garantir segurança jurídica às partes envolvidas.',
   8),
  ('Filhos e família', 'Reconhecimento e dissolução de paternidade socioafetiva',
   'A paternidade socioafetiva ocorre quando existe um vínculo de cuidado, convivência e afeto entre uma pessoa e uma criança, mesmo sem relação biológica. Atuamos no reconhecimento desse vínculo ou em situações que exigem sua dissolução judicial. O reconhecimento pode garantir direitos como registro civil, herança e responsabilidades familiares. Cada caso é analisado considerando a relação construída ao longo do tempo e sempre priorizando o melhor interesse da criança ou adolescente.',
   9),
  ('Proteção jurídica familiar', 'Interdição e curatela',
   'A interdição e a curatela são medidas jurídicas usadas para proteger pessoas que não possuem capacidade de administrar sua própria vida ou patrimônio. Isso pode ocorrer em casos de doenças, limitações cognitivas ou outras condições que comprometem a autonomia. O processo judicial nomeia um responsável legal para cuidar de interesses pessoais, financeiros e patrimoniais. Atuamos desde a orientação inicial até a condução do processo, buscando garantir proteção, segurança jurídica e preservação dos direitos da pessoa envolvida.',
   10),
  ('Sucessões e herança', 'Inventário',
   'O inventário é o procedimento legal utilizado para organizar e formalizar a divisão dos bens deixados por uma pessoa falecida. Esse processo pode ser realizado de forma judicial ou extrajudicial, dependendo da situação da família e da existência de conflitos entre os herdeiros. Atuamos na identificação dos bens, regularização da documentação e definição da partilha. Também orientamos sobre impostos, documentos e etapas necessárias para concluir o processo, garantindo uma transmissão patrimonial segura e organizada.',
   11),
  ('Sucessões e herança', 'Partilha de bens',
   'A partilha de bens é o processo de divisão do patrimônio entre herdeiros ou entre cônjuges após uma separação ou falecimento. Esse procedimento exige análise jurídica para garantir que cada parte receba o que lhe é devido. Atuamos na organização e formalização da divisão dos bens, buscando evitar conflitos e garantir segurança jurídica. O processo pode ocorrer de forma amigável ou judicial, conforme a situação de cada caso.',
   12),
  ('Sucessões e herança', 'Testamento',
   'Auxiliamos na elaboração de testamentos para que a pessoa possa definir como deseja que seu patrimônio seja distribuído após sua morte. O testamento é um instrumento jurídico que ajuda a evitar conflitos familiares e garante que a vontade do autor seja respeitada. Também atuamos em casos de validação ou contestação de testamentos quando surgem questionamentos legais. Todo o processo é conduzido com base na legislação vigente, garantindo segurança jurídica na organização da sucessão patrimonial.',
   13),
  ('Sucessões e herança', 'Herança',
   'Atuamos em questões relacionadas ao reconhecimento de herdeiros e à resolução de disputas envolvendo o patrimônio deixado por uma pessoa falecida. Orientamos sobre direitos sucessórios e analisamos cada situação para garantir que a divisão dos bens ocorra de acordo com a legislação. Também conduzimos processos judiciais quando necessário, buscando proteger os direitos dos herdeiros e reduzir conflitos familiares durante o processo sucessório.',
   14),
  ('Sucessões e herança', 'Planejamento sucessório',
   'O planejamento sucessório é uma estratégia jurídica utilizada para organizar antecipadamente a transmissão de patrimônio entre gerações. Esse planejamento ajuda a evitar conflitos familiares, reduzir burocracias e trazer mais segurança para a família. Atuamos na estruturação de soluções legais, como testamentos e doações em vida, para organizar a sucessão de forma clara e eficiente. Cada planejamento é personalizado de acordo com a realidade e os objetivos da família, garantindo maior proteção e organização do patrimônio.',
   15),
  ('Sucessões e herança', 'Arrolamento de bens',
   'O arrolamento de bens é um procedimento simplificado utilizado quando a partilha de patrimônio possui menor complexidade. Esse processo permite uma divisão mais rápida dos bens entre os herdeiros, reduzindo burocracia e tempo de tramitação. Atuamos na organização da documentação e condução do procedimento para garantir que a partilha seja realizada de forma legal, segura e mais ágil.',
   16),
  ('Planejamento patrimonial', 'Doações em vida',
   'A doação em vida é uma estratégia jurídica que permite transferir parte do patrimônio ainda durante a vida do titular. Esse planejamento ajuda a organizar a sucessão e pode evitar conflitos entre herdeiros no futuro. Atuamos na estruturação das doações dentro da legislação, orientando sobre limites legais, impostos e impactos patrimoniais. Cada caso é analisado para garantir segurança jurídica e uma organização patrimonial mais planejada.',
   17),
  ('Planejamento patrimonial', 'Planejamento patrimonial',
   'O planejamento patrimonial consiste na organização estratégica dos bens de uma pessoa ou família para garantir proteção, gestão eficiente e segurança jurídica. Esse processo envolve análise do patrimônio e definição de estratégias para preservação e transmissão dos bens. Atuamos na estruturação de soluções legais que ajudam a evitar riscos, conflitos familiares e perdas financeiras, sempre considerando aspectos sucessórios e tributários para proteger o patrimônio ao longo do tempo.',
   18),
  ('Casamento e relacionamento', 'Acordos de convivência ou pré-nupciais',
   'Elaboramos contratos de convivência e acordos pré-nupciais para organizar juridicamente a relação entre o casal. Esses documentos definem regras sobre patrimônio, responsabilidades e direitos dentro do relacionamento. O acordo pode ser feito antes do casamento ou durante a união estável. Atuamos na elaboração personalizada desses contratos, garantindo segurança jurídica e prevenindo conflitos futuros entre as partes.',
   19);
