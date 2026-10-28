document.getElementById("btn_perguntar").addEventListener("click", function(){perguntar()})
const msg = document.getElementById("campo_resposta")

async function perguntar() {
    const promt_user = document.getElementById("promt_user").value 
    const url = "http://localhost:11434/api/generate"

    const jsonBody = {
        "model": "llama3.2",
        "prompt": promt_user,
        "stream": false
    }

    try{
        const resposta = await fetch(url, {
            method:"POST",
            headers:{ 'Content-Type': 'application/json'},
            body:JSON.stringify(jsonBody)
        })
        if(!resposta.ok){
            throw new Error("Erro na requisição: ", resposta.status)
        }

        const resultado = await resposta.json()
        msg.textContent = resultado.response
    } catch(erro){
        console.error("Falha ao enviar:", erro)
    }

}
