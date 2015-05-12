class CreateLogfiles < ActiveRecord::Migration
  def change
    create_table :logfiles do |t|
      t.datetime :time
      t.string :app
      t.string :tool
      t.string :testfile
      t.integer :noworker
      t.string :vmmem
      t.string :machinetype
      t.string :attachment

      t.timestamps null: false
    end
  end
end
