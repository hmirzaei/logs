Logs::Application.routes.draw do
  resources :logfiles, only: [:index, :new, :create, :destroy, :show]
  root "logfiles#index"
end

