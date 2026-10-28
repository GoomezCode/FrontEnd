document.getElementById("cep_user").addEventListener("blur", buscarCep);

function buscarCep(){
    let cep = this.value.replace(/\D/g, '');

  if (cep.length === 8) {
    let url = `https://viacep.com.br/ws/${cep}/json/`;

    fetch(url)
      .then((resposta) => resposta.json())
      .then((dados) => {
        if (!dados.erro) {
          document.getElementById("endereco_user").value = dados.logradouro;
          document.getElementById("bairro_user").value = dados.bairro,
          document.getElementById("localidade_user").value = dados.localidade
        } else {
          alert("CEP não Encontrado!!");
        }
      })
      .catch((error) => console.log(`Erro ao buscar o CEP: ${cep}`));
  } else {
    alert("CEP não é Valido!!");
  }
}
