class AddSimtimeToLogfile < ActiveRecord::Migration
  def change
    add_column :logfiles, :simtime, :integer
  end
end
